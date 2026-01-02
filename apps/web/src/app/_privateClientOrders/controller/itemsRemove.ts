import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderItems } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import recalculateOrderTotals from '../utils/recalculateOrderTotals';

const removeItemSchema = z.object({
  itemId: z.string().uuid(),
});

/**
 * Remove a line item from a private client order
 *
 * Partners can remove items from their own orders that are in draft or revision_requested status.
 */
const itemsRemove = winePartnerProcedure.input(removeItemSchema).mutation(async ({ input, ctx }) => {
  const { itemId } = input;
  const { partnerId } = ctx;

  // Fetch the item with its order
  const item = await db.query.privateClientOrderItems.findFirst({
    where: { id: itemId },
    with: {
      order: {
        columns: { id: true, partnerId: true, status: true },
      },
    },
  });

  if (!item) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Item not found',
    });
  }

  // Verify ownership
  if (item.order.partnerId !== partnerId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to remove this item',
    });
  }

  // Check order status allows editing
  const editableStatuses = ['draft', 'revision_requested'];
  if (!editableStatuses.includes(item.order.status)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cannot remove items from an order that has been submitted for review',
    });
  }

  // Delete the item
  await db.delete(privateClientOrderItems).where(eq(privateClientOrderItems.id, itemId));

  // Recalculate order totals using partner settings
  await recalculateOrderTotals(item.order.id);

  return { success: true, deletedItemId: itemId };
});

export default itemsRemove;
