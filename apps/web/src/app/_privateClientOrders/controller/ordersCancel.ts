import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { approvedProcedure } from '@/lib/trpc/procedures';

import partnerOrderView from '../utils/partnerOrderView';
import resolveOrderParty from '../utils/resolveOrderParty';

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
const ordersCancel = approvedProcedure.input(cancelOrderSchema).mutation(async ({ input, ctx }) => {
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

  // C&C staff, or a member of the wine partner who placed it (not view-only)
  const { party, canWrite } = await resolveOrderParty(user, order);
  const isAdmin = party === 'staff';
  const partnerId = party === 'partner' ? order.partnerId : null;

  if (!isAdmin && (party !== 'partner' || !canWrite)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message:
        party === 'partner'
          ? 'You have view-only access to this account. Ask its owner to change your access.'
          : 'You do not have permission to cancel this order',
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

  // Update order status, unless someone else changed it a moment ago
  const [updatedOrder] = await db
    .update(privateClientOrders)
    .set({
      status: newStatus,
      cancelledAt: new Date(),
      cancelledBy: user.id,
      cancellationReason: reason,
      updatedAt: new Date(),
    })
    .where(and(eq(privateClientOrders.id, orderId), eq(privateClientOrders.status, previousStatus)))
    .returning();

  if (!updatedOrder) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'The order changed while you were cancelling it. Refresh and try again.',
    });
  }

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

  return isAdmin ? updatedOrder : partnerOrderView(updatedOrder);
});

export default ordersCancel;
