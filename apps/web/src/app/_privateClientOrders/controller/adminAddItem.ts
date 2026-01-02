import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrderItems, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import addItemSchema from '../schemas/addItemSchema';
import recalculateOrderTotals from '../utils/recalculateOrderTotals';

/**
 * Admin add a line item to a private client order
 *
 * Admins can add items to any order. Order must be in editable status.
 * Automatically recalculates order totals.
 */
const adminAddItem = adminProcedure
  .input(addItemSchema)
  .mutation(async ({ input }) => {
    const { orderId, quantity, pricePerCaseUsd, ...itemData } = input;

    // Verify order exists
    const [order] = await db
      .select()
      .from(privateClientOrders)
      .where(eq(privateClientOrders.id, orderId));

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    // Only allow edits in draft or revision_requested status
    if (!['draft', 'revision_requested'].includes(order.status)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Order cannot be modified in current status',
      });
    }

    const totalUsd = quantity * pricePerCaseUsd;

    // Insert the item
    const [item] = await db
      .insert(privateClientOrderItems)
      .values({
        orderId,
        ...itemData,
        quantity,
        pricePerCaseUsd,
        totalUsd,
      })
      .returning();

    // Recalculate order totals
    await recalculateOrderTotals(orderId);

    return item;
  });

export default adminAddItem;
