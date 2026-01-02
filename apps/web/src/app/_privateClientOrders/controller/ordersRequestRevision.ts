import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partnerMembers, privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const requestRevisionSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(1, 'Reason is required'),
});

/**
 * Request revision for a private client order
 *
 * Admin requests changes to an order that is under review.
 * The order status changes to 'revision_requested'.
 */
const ordersRequestRevision = adminProcedure.input(requestRevisionSchema).mutation(async ({ input, ctx }) => {
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

  // Validate current status allows revision request
  const validStatuses = ['submitted', 'under_cc_review'];
  if (!validStatuses.includes(order.status)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot request revision for order with status "${order.status}". Order must be submitted or under review.`,
    });
  }

  const previousStatus = order.status;
  const newStatus = 'revision_requested';

  // Update order status
  const [updatedOrder] = await db
    .update(privateClientOrders)
    .set({
      status: newStatus,
      revisionRequestedAt: new Date(),
      revisionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(privateClientOrders.id, orderId))
    .returning();

  // Log the activity
  await db.insert(privateClientOrderActivityLogs).values({
    orderId,
    userId: user.id,
    action: 'revision_requested',
    previousStatus,
    newStatus,
    notes: reason,
  });

  // Send notifications to partner members
  if (order.partnerId) {
    const members = await db
      .select({ userId: partnerMembers.userId })
      .from(partnerMembers)
      .where(eq(partnerMembers.partnerId, order.partnerId));

    for (const member of members) {
      await createNotification({
        userId: member.userId,
        type: 'revision_requested',
        title: 'Order Revision Requested',
        message: `C&C has made changes to order ${updatedOrder?.orderNumber ?? orderId} that need your review.`,
        entityType: 'private_client_order',
        entityId: orderId,
        actionUrl: `/platform/private-orders/${orderId}`,
      });
    }
  }

  return updatedOrder;
});

export default ordersRequestRevision;
