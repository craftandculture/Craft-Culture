import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderItems } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import recalculateOrderTotals from '../utils/recalculateOrderTotals';

const adminRemoveItemSchema = z.object({
  itemId: z.string().uuid(),
});

// Statuses where admin cannot edit (final statuses)
const NON_EDITABLE_STATUSES = ['delivered', 'cancelled'];

/**
 * Admin remove a line item from a private client order
 *
 * Admins can remove items from any order except delivered or cancelled orders.
 */
const adminRemoveItem = adminProcedure
  .input(adminRemoveItemSchema)
  .mutation(async ({ input }) => {
    const { itemId } = input;

    // Fetch the item with its order
    const item = await db.query.privateClientOrderItems.findFirst({
      where: { id: itemId },
      with: {
        order: {
          columns: { id: true, status: true },
        },
      },
    });

    if (!item) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Item not found',
      });
    }

    // Check order status allows editing
    if (NON_EDITABLE_STATUSES.includes(item.order.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot remove items from a delivered or cancelled order',
      });
    }

    // Delete the item
    await db.delete(privateClientOrderItems).where(eq(privateClientOrderItems.id, itemId));

    // Recalculate order totals
    await recalculateOrderTotals(item.order.id);

    return { success: true, deletedItemId: itemId };
  });

export default adminRemoveItem;
