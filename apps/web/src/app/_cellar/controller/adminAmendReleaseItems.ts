import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import getClaimedBottles from '@/app/_cellar/data/getClaimedBottles';
import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  wmsStock,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

/**
 * Change the wines on a release request before it is priced
 *
 * The only answer to a list that was nearly right was to send the whole request
 * back to the member, and wait. Taking a wine off, or adding the bottle they
 * asked for on the phone, is quicker done here.
 *
 * Lines are addressed by their own id, not by parcel, so a line the merge bug
 * left without a parcel can still be removed or reduced. Adding bottles needs
 * the parcel, because that is the only way to know there are bottles to add.
 *
 * A request already quoted goes back to awaiting review with its figures
 * cleared. The member was holding a price for a different list, and accepting
 * it would have charged them for the wrong wine.
 */
const adminAmendReleaseItems = staffAdminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      /** Every line to keep; a line left out is removed */
      lines: z
        .array(
          z.object({
            itemId: z.string().uuid(),
            bottles: z.number().int().min(1),
          }),
        )
        .min(1, 'A request needs at least one wine. Cancel it instead.')
        .max(200)
        .refine(
          (lines) =>
            new Set(lines.map((line) => line.itemId)).size === lines.length,
          'Each line can appear only once.',
        ),
    }),
  )
  .mutation(async ({ input }) => {
    const [request] = await db
      .select({
        id: cellarReleaseRequests.id,
        partnerId: cellarReleaseRequests.partnerId,
        status: cellarReleaseRequests.status,
      })
      .from(cellarReleaseRequests)
      .where(eq(cellarReleaseRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
    }

    if (
      !['submitted', 'under_review', 'revision_requested'].includes(
        request.status,
      )
    ) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `This request is ${request.status.replace(/_/g, ' ')} and its wines cannot be changed here.`,
      });
    }

    const items = await db
      .select({
        id: cellarReleaseRequestItems.id,
        stockId: cellarReleaseRequestItems.stockId,
        productName: cellarReleaseRequestItems.productName,
        bottles: cellarReleaseRequestItems.bottles,
      })
      .from(cellarReleaseRequestItems)
      .where(eq(cellarReleaseRequestItems.requestId, request.id));

    const itemsById = new Map(items.map((item) => [item.id, item]));

    for (const line of input.lines) {
      if (!itemsById.has(line.itemId)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'The member changed this request while you were working on it. Refresh and look again.',
        });
      }
    }

    const increased = input.lines.filter(
      (line) => line.bottles > (itemsById.get(line.itemId)?.bottles ?? 0),
    );

    /*
      More bottles than the member asked for have to exist, belong to them and
      not be promised elsewhere — the same check the member's own screen
      faces, with this request left out of its own claim.
    */
    if (increased.length > 0) {
      const stockIds = increased
        .map((line) => itemsById.get(line.itemId)?.stockId)
        .filter((id): id is string => Boolean(id));

      const owned = stockIds.length
        ? await db
            .select({
              id: wmsStock.id,
              caseConfig: wmsStock.caseConfig,
              quantityCases: wmsStock.quantityCases,
              openBottles: wmsStock.openBottles,
            })
            .from(wmsStock)
            .where(
              and(
                inArray(wmsStock.id, stockIds),
                eq(wmsStock.ownerId, request.partnerId),
              ),
            )
        : [];

      const ownedById = new Map(owned.map((row) => [row.id, row]));
      const claimed = await getClaimedBottles(stockIds, {
        exceptRequestId: request.id,
      });

      for (const line of increased) {
        const item = itemsById.get(line.itemId);
        const stock = item?.stockId ? ownedById.get(item.stockId) : undefined;

        if (!item || !stock) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${item?.productName ?? 'That wine'} is no longer held in the member's cellar, so no bottles can be added.`,
          });
        }

        const available =
          stock.quantityCases * (stock.caseConfig ?? 1) +
          (stock.openBottles ?? 0) -
          (claimed.get(stock.id) ?? 0);

        if (line.bottles > available) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${Math.max(available, 0)} ${available === 1 ? 'bottle' : 'bottles'} of ${item.productName} ${available === 1 ? 'is' : 'are'} free to deliver. The rest is under offer or already on a delivery.`,
          });
        }
      }
    }

    const keep = new Set(input.lines.map((line) => line.itemId));
    const removed = items.filter((item) => !keep.has(item.id));
    const changed = input.lines.filter(
      (line) => line.bottles !== itemsById.get(line.itemId)?.bottles,
    );

    if (removed.length === 0 && changed.length === 0) {
      return { status: request.status, removed: 0, changed: 0 };
    }

    const wasQuoted = request.status === 'under_review';

    /*
      The request is touched first under the status it was read with, so a
      member amending or accepting at the same moment either lands first and
      this refuses, or waits.
    */
    await db.transaction(async (tx) => {
      const [touched] = await tx
        .update(cellarReleaseRequests)
        .set({
          updatedAt: new Date(),
          ...(wasQuoted
            ? {
                status: 'submitted' as const,
                goodsValueUsd: null,
                clearanceCostUsd: null,
                deliveryCostUsd: null,
                serviceFeeUsd: null,
                repackCostUsd: null,
                repackCases: null,
                additionalChargeUsd: null,
                additionalChargeLabel: null,
                totalCostUsd: null,
                quotedAt: null,
                quotedBy: null,
              }
            : {}),
        })
        .where(
          and(
            eq(cellarReleaseRequests.id, request.id),
            eq(cellarReleaseRequests.status, request.status),
          ),
        )
        .returning({ id: cellarReleaseRequests.id });

      if (!touched) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'The member changed this request while you were working on it. Refresh and look again.',
        });
      }

      if (removed.length > 0) {
        await tx.delete(cellarReleaseRequestItems).where(
          inArray(
            cellarReleaseRequestItems.id,
            removed.map((item) => item.id),
          ),
        );
      }

      for (const line of changed) {
        await tx
          .update(cellarReleaseRequestItems)
          .set({ bottles: line.bottles })
          .where(eq(cellarReleaseRequestItems.id, line.itemId));
      }
    });

    return {
      status: wasQuoted ? ('submitted' as const) : request.status,
      removed: removed.length,
      changed: changed.length,
    };
  });

export default adminAmendReleaseItems;
