import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders, users } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const submitOrderSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Submit a draft order for C&C review
 *
 * Partners can submit their draft orders for review by Craft & Culture.
 * The order must be in 'draft' or 'revision_requested' status.
 */
const ordersSubmit = winePartnerProcedure.input(submitOrderSchema).mutation(async ({ input, ctx }) => {
  const { orderId, notes } = input;
  const { partnerId, user } = ctx;

  // Fetch the order
  const order = await db.query.privateClientOrders.findFirst({
    where: { id: orderId, partnerId },
    with: {
      items: true,
    },
  });

  if (!order) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Order not found or not owned by you',
    });
  }

  // Validate current status allows submission
  if (order.status !== 'draft' && order.status !== 'revision_requested') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot submit order with status "${order.status}". Order must be in draft or revision_requested status.`,
    });
  }

  // Validate order has items
  if (!order.items || order.items.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cannot submit an order with no items',
    });
  }

  // Validate client information
  if (!order.clientName) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Client name is required before submitting',
    });
  }

  const previousStatus = order.status;
  const newStatus = 'submitted';

  // Update order status
  const [updatedOrder] = await db
    .update(privateClientOrders)
    .set({
      status: newStatus,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(privateClientOrders.id, orderId))
    .returning();

  // Log the activity
  await db.insert(privateClientOrderActivityLogs).values({
    orderId,
    userId: user.id,
    partnerId,
    action: 'order_submitted',
    previousStatus,
    newStatus,
    notes,
  });

  // Notify admins that there's a new order to review
  const adminUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'));

  for (const admin of adminUsers) {
    await createNotification({
      userId: admin.id,
      type: 'action_required',
      title: 'New Private Order Submitted',
      message: `Order ${updatedOrder?.orderNumber ?? orderId} has been submitted and needs review.`,
      entityType: 'private_client_order',
      entityId: orderId,
      actionUrl: `/platform/admin/private-orders/${orderId}`,
    });
  }

  return updatedOrder;
});

export default ordersSubmit;
