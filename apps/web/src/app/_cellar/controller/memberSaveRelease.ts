import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  wmsStock,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import EDITABLE_STATUSES from '../utils/editableStatuses';
import generateReleaseNumber from '../utils/generateReleaseNumber';
import notifyReleaseUpdate from '../utils/notifyReleaseUpdate';

/**
 * Create or amend a release request
 *
 * The whole line set is sent each time and replaces what was there. A member
 * adding a wine, changing a quantity and removing another is one intention,
 * and treating it as three separate operations invites a half-applied basket
 * if one of them fails.
 *
 * A member who already has a request with us and has not been quoted yet gets
 * their new wines ADDED to it rather than a second request opened. Sending
 * three bottles, then two more, then a case is one delivery as far as the
 * member is concerned, and turning it into three is three lots of clearance
 * paperwork, three quotes and three drives for wine going to one address.
 * Once we have quoted, adding would invalidate a figure already sent, so from
 * that point a new request is correct.
 *
 * Every line is checked against stock the member actually owns, and against
 * how much of it is there — the cellar screen already knows both, but a
 * request arriving over the wire does not get to assert them.
 */
const memberSaveRelease = stockOwnerProcedure
  .input(
    z.object({
      requestId: z.string().uuid().optional(),
      deliveryAddress: z.string().max(500).optional(),
      memberNotes: z.string().max(1000).optional(),
      lines: z
        .array(
          z.object({
            stockId: z.string().uuid(),
            bottles: z.number().int().min(1),
          }),
        )
        .min(1, 'Choose at least one wine')
        .max(200),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const stockIds = input.lines.map((line) => line.stockId);

    const owned = await db
      .select({
        id: wmsStock.id,
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        vintage: wmsStock.vintage,
        bottleSize: wmsStock.bottleSize,
        caseConfig: wmsStock.caseConfig,
        quantityCases: wmsStock.quantityCases,
        openBottles: wmsStock.openBottles,
        lotNumber: wmsStock.lotNumber,
      })
      .from(wmsStock)
      .where(
        and(
          inArray(wmsStock.id, stockIds),
          eq(wmsStock.ownerId, ctx.partner.id),
        ),
      );

    /*
      Rebuilt after a merge, which is why this is not const. Merging pushes the
      open request's lines onto input.lines, and a map built before that does
      not contain them.
    */
    let ownedById = new Map(owned.map((row) => [row.id, row]));

    for (const line of input.lines) {
      const stock = ownedById.get(line.stockId);

      if (!stock) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One of those wines is not held in your cellar.',
        });
      }

      const available =
        stock.quantityCases * (stock.caseConfig ?? 1) + (stock.openBottles ?? 0);

      if (line.bottles > available) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `You hold ${available} ${available === 1 ? 'bottle' : 'bottles'} of ${stock.productName}.`,
        });
      }
    }

    /*
      Statuses where more wine can still join. 'under_review' is deliberately
      absent: the member is holding a figure we quoted, and quietly changing
      what it covers would make that figure wrong.
    */
    const [openRequest] = input.requestId
      ? []
      : await db
          .select({
            id: cellarReleaseRequests.id,
            requestNumber: cellarReleaseRequests.requestNumber,
            status: cellarReleaseRequests.status,
          })
          .from(cellarReleaseRequests)
          .where(
            and(
              eq(cellarReleaseRequests.partnerId, ctx.partner.id),
              inArray(cellarReleaseRequests.status, [
                'draft',
                'submitted',
                'revision_requested',
              ]),
            ),
          )
          .orderBy(desc(cellarReleaseRequests.createdAt))
          .limit(1);

    let requestId = input.requestId ?? openRequest?.id;
    let merged = false;

    if (openRequest && !input.requestId) {
      merged = true;

      /*
        Merged, not replaced. The basket holds what the member just chose; the
        request holds what they chose earlier. Summing them per parcel — and
        capping at what is actually held — is the only reading that does not
        silently discard one of the two.
      */
      const existingItems = await db
        .select({
          stockId: cellarReleaseRequestItems.stockId,
          bottles: cellarReleaseRequestItems.bottles,
        })
        .from(cellarReleaseRequestItems)
        .where(eq(cellarReleaseRequestItems.requestId, openRequest.id));

      for (const item of existingItems) {
        if (!item.stockId) continue;

        const line = input.lines.find((row) => row.stockId === item.stockId);

        if (line) line.bottles += item.bottles;
        else
          input.lines.push({ stockId: item.stockId, bottles: item.bottles });
      }

      /*
        The merged quantities have to face the same ownership and availability
        checks the new ones did — two requests of four bottles each against a
        parcel of six must not become a request for eight.
      */
      const mergedStockIds = input.lines.map((line) => line.stockId);

      /*
        Every column the insert below copies, not just the ones this loop
        validates against.

        This selected four fields and the insert then read the pre-merge map,
        so a line pushed here was written with an empty LWIN and no vintage,
        format or lot — the wine's own identity, lost by adding a second
        request to it. It also broke the quote, since cost is looked up by
        LWIN and an empty one matches nothing, which is how a merged request
        came to be valued at nought.
      */
      const mergedStock = await db
        .select({
          id: wmsStock.id,
          lwin18: wmsStock.lwin18,
          productName: wmsStock.productName,
          vintage: wmsStock.vintage,
          bottleSize: wmsStock.bottleSize,
          caseConfig: wmsStock.caseConfig,
          quantityCases: wmsStock.quantityCases,
          openBottles: wmsStock.openBottles,
          lotNumber: wmsStock.lotNumber,
        })
        .from(wmsStock)
        .where(
          and(
            inArray(wmsStock.id, mergedStockIds),
            eq(wmsStock.ownerId, ctx.partner.id),
          ),
        );

      ownedById = new Map(mergedStock.map((row) => [row.id, row]));

      for (const line of input.lines) {
        const stock = mergedStock.find((row) => row.id === line.stockId);

        if (!stock) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'One of those wines is not held in your cellar.',
          });
        }

        const available =
          stock.quantityCases * (stock.caseConfig ?? 1) +
          (stock.openBottles ?? 0);

        if (line.bottles > available) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${openRequest.requestNumber} already covers some of that. Together it would be ${line.bottles} bottles of ${stock.productName} and you hold ${available}.`,
          });
        }

        ownedById.set(line.stockId, {
          ...(ownedById.get(line.stockId) ?? {
            id: stock.id,
            lwin18: '',
            productName: stock.productName,
            vintage: null,
            bottleSize: null,
            caseConfig: stock.caseConfig,
            quantityCases: stock.quantityCases,
            openBottles: stock.openBottles,
            lotNumber: null,
          }),
        });
      }
    }

    if (requestId) {
      const [existing] = await db
        .select({
          id: cellarReleaseRequests.id,
          status: cellarReleaseRequests.status,
        })
        .from(cellarReleaseRequests)
        .where(
          and(
            eq(cellarReleaseRequests.id, requestId),
            eq(cellarReleaseRequests.partnerId, ctx.partner.id),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
      }

      /*
        A member adding to their own un-quoted request is not "changing a
        request under review" — it is still the same delivery being assembled.
        The guard stands for anything they reached by id.
      */
      if (
        !merged &&
        !EDITABLE_STATUSES.includes(
          existing.status as (typeof EDITABLE_STATUSES)[number],
        )
      ) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'This request is with us for review and can no longer be changed.',
        });
      }

      await db
        .update(cellarReleaseRequests)
        .set({
          ...(input.deliveryAddress
            ? { deliveryAddress: input.deliveryAddress }
            : {}),
          ...(input.memberNotes ? { memberNotes: input.memberNotes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(cellarReleaseRequests.id, requestId));

      await db
        .delete(cellarReleaseRequestItems)
        .where(eq(cellarReleaseRequestItems.requestId, requestId));
    } else {
      const [created] = await db
        .insert(cellarReleaseRequests)
        .values({
          requestNumber: await generateReleaseNumber(),
          partnerId: ctx.partner.id,
          requestedBy: ctx.user.id,
          status: 'draft',
          deliveryAddress: input.deliveryAddress,
          memberNotes: input.memberNotes,
        })
        .returning({ id: cellarReleaseRequests.id });

      requestId = created?.id;
    }

    if (!requestId) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not save that request',
      });
    }

    await db.insert(cellarReleaseRequestItems).values(
      input.lines.map((line) => {
        const stock = ownedById.get(line.stockId);

        return {
          requestId,
          stockId: line.stockId,
          lotNumber: stock?.lotNumber ?? null,
          lwin18: stock?.lwin18 ?? '',
          productName: stock?.productName ?? '',
          vintage: stock?.vintage ?? null,
          bottleSize: stock?.bottleSize ?? null,
          caseConfig: stock?.caseConfig ?? null,
          bottles: line.bottles,
        };
      }),
    );

    /*
      An admin may already have this request open. Telling them it changed is
      the difference between quoting the list in front of them and quoting the
      list the member actually asked for.
    */
    if (merged && openRequest?.status === 'submitted') {
      await notifyReleaseUpdate({
        event: 'submitted',
        amended: true,
        partnerId: ctx.partner.id,
        requestId,
        requestNumber: openRequest.requestNumber,
      });
    }

    return {
      requestId,
      merged,
      requestNumber: openRequest?.requestNumber ?? null,
      alreadySubmitted: merged && openRequest?.status === 'submitted',
    };
  });

export default memberSaveRelease;
