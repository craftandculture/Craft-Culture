import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsCycleCountItems, wmsCycleCounts } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { completeCycleCountSchema } from '../schemas/cycleCountSchema';

/**
 * Complete a cycle count — calculates discrepancies and sets status to completed
 *
 * All items must have a counted quantity before completing.
 *
 * @example
 *   await trpcClient.wms.admin.cycleCounts.complete.mutate({
 *     countId: "uuid",
 *   });
 */
const adminCompleteCycleCount = adminProcedure
  .input(completeCycleCountSchema)
  .mutation(async ({ input }) => {
    const { countId } = input;

    const [cycleCount] = await db
      .select()
      .from(wmsCycleCounts)
      .where(eq(wmsCycleCounts.id, countId));

    if (!cycleCount) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Cycle count not found',
      });
    }

    if (cycleCount.status !== 'in_progress') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Count must be in progress to complete',
      });
    }

    // Get all items
    const items = await db
      .select()
      .from(wmsCycleCountItems)
      .where(eq(wmsCycleCountItems.cycleCountId, countId));

    // Check all items have been counted
    const uncounted = items.filter((i) => i.countedQuantity === null);
    if (uncounted.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${uncounted.length} item(s) have not been counted yet`,
      });
    }

    // Calculate discrepancies per item
    let totalCounted = 0;
    let discrepancyCount = 0;

    for (const item of items) {
      const counted = item.countedQuantity ?? 0;
      const discrepancy = counted - item.expectedQuantity;
      totalCounted += counted;
      if (discrepancy !== 0) discrepancyCount++;

      await db
        .update(wmsCycleCountItems)
        .set({
          discrepancy,
          updatedAt: new Date(),
        })
        .where(eq(wmsCycleCountItems.id, item.id));
    }

    // Update header
    await db
      .update(wmsCycleCounts)
      .set({
        status: 'completed',
        countedItems: totalCounted,
        discrepancyCount,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wmsCycleCounts.id, countId));

    return {
      success: true,
      totalExpected: cycleCount.expectedItems,
      totalCounted,
      discrepancyCount,
      totalItems: items.length,
    };
  });

export default adminCompleteCycleCount;
