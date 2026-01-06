import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqItems, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import deleteItemSchema from '../schemas/deleteItemSchema';

/**
 * Delete an item from a SOURCE RFQ
 *
 * @example
 *   await trpcClient.source.admin.deleteItem.mutate({
 *     itemId: "uuid-here"
 *   });
 */
const adminDeleteItem = adminProcedure
  .input(deleteItemSchema)
  .mutation(async ({ input }) => {
    const { itemId } = input;

    // Verify item exists and get RFQ info
    const [existing] = await db
      .select({
        item: sourceRfqItems,
        rfqId: sourceRfqItems.rfqId,
        rfqStatus: sourceRfqs.status,
      })
      .from(sourceRfqItems)
      .innerJoin(sourceRfqs, eq(sourceRfqItems.rfqId, sourceRfqs.id))
      .where(eq(sourceRfqItems.id, itemId));

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Item not found',
      });
    }

    // Check if RFQ is in editable state
    const editableStatuses = ['draft', 'parsing', 'ready_to_send'];
    if (!editableStatuses.includes(existing.rfqStatus)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot delete items from RFQ that has been sent',
      });
    }

    // Delete the item
    await db.delete(sourceRfqItems).where(eq(sourceRfqItems.id, itemId));

    // Decrement item count on RFQ
    await db
      .update(sourceRfqs)
      .set({ itemCount: sql`GREATEST(${sourceRfqs.itemCount} - 1, 0)` })
      .where(eq(sourceRfqs.id, existing.rfqId));

    return { success: true };
  });

export default adminDeleteItem;
