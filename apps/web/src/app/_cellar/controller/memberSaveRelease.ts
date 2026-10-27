import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import getClaimedBottles from '@/app/_cellar/data/getClaimedBottles';
import assertActivated from '@/app/_onboarding/data/assertActivated';
import db from '@/database/client';
import {
  cellarDeliveryAddresses,
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  wmsStock,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import saveReleaseDeliveryDetails from '../data/saveReleaseDeliveryDetails';
import earliestDeliveryDate, {
  DELIVERY_LEAD_WORKING_DAYS,
} from '../utils/earliestDeliveryDate';
import EDITABLE_STATUSES from '../utils/editableStatuses';
import generateReleaseNumber from '../utils/generateReleaseNumber';
import notifyReleaseUpdate from '../utils/notifyReleaseUpdate';
import withNumberRetry from '../utils/withNumberRetry';

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
      /*
        How the member would like it delivered. Optional so an older screen
        still open in a browser keeps working.
      */
      delivery: z
        .object({
          /** A saved address; its text replaces deliveryAddress above */
          addressId: z.string().uuid().nullable().optional(),
          deliveryInstructions: z.string().max(500).nullable().optional(),
          preferredDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable()
            .optional(),
          preferredWindow: z
            .enum(['morning', 'afternoon', 'any'])
            .nullable()
            .optional(),
          gift: z
            .object({
              recipientName: z
                .string()
                .trim()
                .min(2, 'Add the name of the person receiving the wine')
                .max(120),
              recipientPhone: z
                .string()
                .trim()
                .min(7, 'Add a mobile number for the person receiving the wine')
                .max(30),
              message: z.string().trim().max(300).nullable().optional(),
            })
            .nullable()
            .optional(),
        })
        .optional(),
      lines: z
        .array(
          z.object({
            stockId: z.string().uuid(),
            bottles: z.number().int().min(1),
          }),
        )
        .min(1, 'Choose at least one wine')
        .max(200)
        .refine(
          (lines) => new Set(lines.map((line) => line.stockId)).size === lines.length,
          'Each wine can appear only once. Combine the quantities on one line.',
        ),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await assertActivated(ctx.partner.id);

    /*
      A preferred day sooner than the wine can be cleared from bond is a
      promise the team cannot keep, and it would sit on the request looking
      like a missed one. The same rule as the date picker.
    */
    if (input.delivery?.preferredDate) {
      const earliest = earliestDeliveryDate();

      if (input.delivery.preferredDate < earliest) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Clearing wine from bond takes about ${DELIVERY_LEAD_WORKING_DAYS} working days. Choose a preferred day from ${new Date(`${earliest}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} onwards.`,
        });
      }
    }

    /*
      A saved address is read from the member's own list, never trusted from
      the request, so the text on the delivery is what they actually saved.
    */
    let chosenAddress:
      | { id: string; label: string; address: string; instructions: string | null }
      | undefined;

    if (input.delivery?.addressId) {
      [chosenAddress] = await db
        .select({
          id: cellarDeliveryAddresses.id,
          label: cellarDeliveryAddresses.label,
          address: cellarDeliveryAddresses.address,
          instructions: cellarDeliveryAddresses.instructions,
        })
        .from(cellarDeliveryAddresses)
        .where(
          and(
            eq(cellarDeliveryAddresses.id, input.delivery.addressId),
            eq(cellarDeliveryAddresses.partnerId, ctx.partner.id),
          ),
        )
        .limit(1);

      if (!chosenAddress) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'That address is not one of yours.',
        });
      }

      input.deliveryAddress = chosenAddress.address;
    }

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

    /*
      Bottles already offered for sale or due on another delivery are not free
      to request. The request being edited is left out of its own count.
    */
    const claimed = await getClaimedBottles(stockIds, {
      exceptRequestId: input.requestId,
    });

    for (const line of input.lines) {
      const stock = ownedById.get(line.stockId);

      if (!stock) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One of those wines is not held in your cellar.',
        });
      }

      const available =
        stock.quantityCases * (stock.caseConfig ?? 1) +
        (stock.openBottles ?? 0) -
        (claimed.get(line.stockId) ?? 0);

      if (line.bottles > available) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${Math.max(available, 0)} ${available === 1 ? 'bottle' : 'bottles'} of ${stock.productName} ${available === 1 ? 'is' : 'are'} free to deliver. The rest is under offer or already on a delivery.`,
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

      /* The open request is now part of this one, so its claim is left out. */
      const mergedClaimed = await getClaimedBottles(mergedStockIds, {
        exceptRequestId: openRequest.id,
      });

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
          (stock.openBottles ?? 0) -
          (mergedClaimed.get(line.stockId) ?? 0);

        if (line.bottles > available) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${openRequest.requestNumber} already covers some of that. Together it would be ${line.bottles} bottles of ${stock.productName} and ${Math.max(available, 0)} ${available === 1 ? 'is' : 'are'} free to deliver.`,
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

    /*
      One transaction, and the status re-checked as it is written. Staff can
      quote a request between the member opening their basket and pressing
      save; without this the member's lines replaced the list that had just
      been quoted, and accepting then raised the bigger order at the smaller
      figure. The row is locked, the status must still be the one read, and
      the lines are replaced in the same transaction — all or nothing.
    */
    const MERGEABLE_STATUSES = ['draft', 'submitted', 'revision_requested'];

    requestId = await db.transaction(async (tx) => {
      let savedId = requestId;

      if (savedId) {
        const [existing] = await tx
          .select({
            id: cellarReleaseRequests.id,
            status: cellarReleaseRequests.status,
          })
          .from(cellarReleaseRequests)
          .where(
            and(
              eq(cellarReleaseRequests.id, savedId),
              eq(cellarReleaseRequests.partnerId, ctx.partner.id),
            ),
          )
          .for('update')
          .limit(1);

        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
        }

        /*
          A member adding to their own un-quoted request is not "changing a
          request under review" — it is still the same delivery being
          assembled. The guard stands for anything they reached by id. A
          merge must still find the request in the status it was read in.
        */
        const stillOpen = merged
          ? existing.status === openRequest?.status &&
            MERGEABLE_STATUSES.includes(existing.status)
          : EDITABLE_STATUSES.includes(
              existing.status as (typeof EDITABLE_STATUSES)[number],
            );

        if (!stillOpen) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: merged
              ? 'Your earlier request has just been updated by our team. Please refresh and try again.'
              : 'This request is with us for review and can no longer be changed.',
          });
        }

        const [updated] = await tx
          .update(cellarReleaseRequests)
          .set({
            ...(input.deliveryAddress
              ? { deliveryAddress: input.deliveryAddress }
              : {}),
            ...(input.memberNotes ? { memberNotes: input.memberNotes } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(cellarReleaseRequests.id, savedId),
              eq(cellarReleaseRequests.status, existing.status),
            ),
          )
          .returning({ id: cellarReleaseRequests.id });

        if (!updated) {
          throw new TRPCError({
            code: 'CONFLICT',
            message:
              'This request has just been updated by our team. Please refresh and try again.',
          });
        }

        await tx
          .delete(cellarReleaseRequestItems)
          .where(eq(cellarReleaseRequestItems.requestId, savedId));
      } else {
        // The number is taken inside the transaction, and retried on a clash
        const created = await withNumberRetry((attempt) =>
          tx.transaction(async (savepoint) => {
            const [row] = await savepoint
              .insert(cellarReleaseRequests)
              .values({
                requestNumber: await generateReleaseNumber(savepoint, attempt),
                partnerId: ctx.partner.id,
                requestedBy: ctx.user.id,
                status: 'draft',
                deliveryAddress: input.deliveryAddress,
                memberNotes: input.memberNotes,
              })
              .returning({ id: cellarReleaseRequests.id });

            return row;
          }),
        );

        savedId = created?.id;
      }

      if (!savedId) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not save that request',
        });
      }

      const itemsRequestId = savedId;

      await tx.insert(cellarReleaseRequestItems).values(
        input.lines.map((line) => {
          const stock = ownedById.get(line.stockId);

          return {
            requestId: itemsRequestId,
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

      return savedId;
    });

    if (input.delivery) {
      const gift = input.delivery.gift;

      await saveReleaseDeliveryDetails(requestId, {
        addressId: chosenAddress?.id ?? null,
        addressLabel: chosenAddress?.label ?? null,
        deliveryInstructions:
          input.delivery.deliveryInstructions ??
          chosenAddress?.instructions ??
          null,
        preferredDate: input.delivery.preferredDate ?? null,
        preferredWindow: input.delivery.preferredWindow ?? null,
        isGift: Boolean(gift),
        recipientName: gift?.recipientName ?? null,
        recipientPhone: gift?.recipientPhone ?? null,
        giftMessage: gift?.message ?? null,
      });
    }

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
