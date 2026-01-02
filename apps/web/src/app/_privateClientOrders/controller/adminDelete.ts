import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  privateClientOrderActivityLogs,
  privateClientOrderDocuments,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const deleteOrderSchema = z.object({
  orderId: z.string().uuid(),
});

/**
 * Permanently delete a private client order (admin only)
 *
 * Deletes the order and all associated data including items, documents, and activity logs.
 * Only orders in draft or cancelled status can be deleted.
 */
const adminDelete = adminProcedure.input(deleteOrderSchema).mutation(async ({ input }) => {
  const { orderId } = input;

  // Fetch the order
  const order = await db.query.privateClientOrders.findFirst({
    where: { id: orderId },
  });

  if (!order) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Order not found',
    });
  }

  // Only allow deletion of draft or cancelled orders
  const deletableStatuses = ['draft', 'cancelled'];
  if (!deletableStatuses.includes(order.status)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot delete order with status "${order.status}". Only draft or cancelled orders can be deleted.`,
    });
  }

  // Delete all related data in correct order (due to foreign keys)
  // 1. Delete activity logs
  await db.delete(privateClientOrderActivityLogs).where(eq(privateClientOrderActivityLogs.orderId, orderId));

  // 2. Delete documents
  await db.delete(privateClientOrderDocuments).where(eq(privateClientOrderDocuments.orderId, orderId));

  // 3. Delete line items
  await db.delete(privateClientOrderItems).where(eq(privateClientOrderItems.orderId, orderId));

  // 4. Delete the order itself
  await db.delete(privateClientOrders).where(eq(privateClientOrders.id, orderId));

  return { success: true, orderNumber: order.orderNumber };
});

export default adminDelete;
