import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

const cancelOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(1, 'Cancellation reason is required'),
});

/**
 * Cancel a private client order
 *
 * Admins can cancel any order.
 * Partners can only cancel their own orders that are in draft or submitted status.
 */
const ordersCancel = protectedProcedure.input(cancelOrderSchema).mutation(async ({ input, ctx }) => {
  const { orderId, reason } = input;
  const { user } = ctx;

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

  // Already cancelled
  if (order.status === 'cancelled') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Order is already cancelled',
    });
  }

  // Check if user is admin
  const isAdmin = user.role === 'admin';

  // Check if user is the partner who owns this order
  let isOwningPartner = false;
  let partnerId: string | null = null;

  if (!isAdmin) {
    const partner = await db.query.partners.findFirst({
      where: { userId: user.id },
      columns: { id: true },
    });

    if (partner && partner.id === order.partnerId) {
      isOwningPartner = true;
      partnerId = partner.id;
    }
  }

  // Validate permissions
  if (!isAdmin && !isOwningPartner) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to cancel this order',
    });
  }

  // Partners can only cancel orders in certain statuses
  if (!isAdmin) {
    const partnerCancellableStatuses = ['draft', 'submitted', 'revision_requested'];
    if (!partnerCancellableStatuses.includes(order.status)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You can only cancel orders that have not been approved yet',
      });
    }
  }

  // Cannot cancel delivered orders
  if (order.status === 'delivered') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cannot cancel a delivered order',
    });
  }

  const previousStatus = order.status;
  const newStatus = 'cancelled';

  // Update order status
  const [updatedOrder] = await db
    .update(privateClientOrders)
    .set({
      status: newStatus,
      cancelledAt: new Date(),
      cancelledBy: user.id,
      cancellationReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(privateClientOrders.id, orderId))
    .returning();

  // Log the activity
  await db.insert(privateClientOrderActivityLogs).values({
    orderId,
    userId: user.id,
    partnerId: partnerId ?? undefined,
    action: 'order_cancelled',
    previousStatus,
    newStatus,
    notes: reason,
  });

  return updatedOrder;
});

export default ordersCancel;
