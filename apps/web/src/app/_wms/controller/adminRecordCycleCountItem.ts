import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsCycleCountItems, wmsCycleCounts } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { recordCycleCountItemSchema } from '../schemas/cycleCountSchema';

/**
 * Record the counted quantity for a single cycle count item
 *
 * @example
 *   await trpcClient.wms.admin.cycleCounts.recordItem.mutate({
 *     cycleCountId: "uuid",
 *     itemId: "uuid",
 *     countedQuantity: 5,
 *   });
 */
const adminRecordCycleCountItem = wmsOperatorProcedure
  .input(recordCycleCountItemSchema)
  .mutation(async ({ input }) => {
    const { cycleCountId, itemId, countedQuantity, notes } = input;

    // Verify the count is in progress
    const [cycleCount] = await db
      .select({ status: wmsCycleCounts.status })
      .from(wmsCycleCounts)
      .where(eq(wmsCycleCounts.id, cycleCountId));

    if (!cycleCount) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Cycle count not found',
      });
    }

    /*
      A completed count can still be corrected: a miscount found at review
      is fixed on the line rather than reconciled into the stock as a loss.
      Once reconciled the adjustments are posted, so the count is closed.
    */
    const isReview = cycleCount.status === 'completed';
    if (cycleCount.status !== 'in_progress' && !isReview) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          cycleCount.status === 'reconciled'
            ? 'This count has been reconciled and can no longer be changed'
            : 'Count must be in progress to record items',
      });
    }

    // Verify the item belongs to this count
    const [item] = await db
      .select()
      .from(wmsCycleCountItems)
      .where(eq(wmsCycleCountItems.id, itemId));

    if (!item) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Cycle count item not found',
      });
    }

    if (item.cycleCountId !== cycleCountId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Item does not belong to this cycle count',
      });
    }

    // Update the item with counted quantity
    await db
      .update(wmsCycleCountItems)
      .set({
        countedQuantity,
        notes: notes ?? item.notes,
        countedAt: new Date(),
        updatedAt: new Date(),
        // At review the discrepancy is already set, so it moves with the count
        ...(isReview ? { discrepancy: countedQuantity - item.expectedQuantity } : {}),
      })
      .where(eq(wmsCycleCountItems.id, itemId));

    if (isReview) {
      const items = await db
        .select({
          countedQuantity: wmsCycleCountItems.countedQuantity,
          discrepancy: wmsCycleCountItems.discrepancy,
        })
        .from(wmsCycleCountItems)
        .where(eq(wmsCycleCountItems.cycleCountId, cycleCountId));

      await db
        .update(wmsCycleCounts)
        .set({
          countedItems: items.reduce((sum, i) => sum + (i.countedQuantity ?? 0), 0),
          discrepancyCount: items.filter((i) => (i.discrepancy ?? 0) !== 0).length,
          updatedAt: new Date(),
        })
        .where(eq(wmsCycleCounts.id, cycleCountId));
    }

    return {
      success: true,
      itemId,
      countedQuantity,
      expectedQuantity: item.expectedQuantity,
    };
  });

export default adminRecordCycleCountItem;
