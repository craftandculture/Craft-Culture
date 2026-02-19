import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsCycleCountItems, wmsCycleCounts } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

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
const adminRecordCycleCountItem = adminProcedure
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

    if (cycleCount.status !== 'in_progress') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Count must be in progress to record items',
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
      })
      .where(eq(wmsCycleCountItems.id, itemId));

    return {
      success: true,
      itemId,
      countedQuantity,
      expectedQuantity: item.expectedQuantity,
    };
  });

export default adminRecordCycleCountItem;
