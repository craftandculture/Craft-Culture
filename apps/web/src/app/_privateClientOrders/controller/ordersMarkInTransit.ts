import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import {
  partnerMembers,
  privateClientOrderActivityLogs,
  privateClientOrders,
} from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

const markInTransitSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Mark order as in transit / out for delivery
 *
 * The distributor marks the order as in transit when they dispatch it.
 * This moves the order to 'out_for_delivery' status.
 */
const ordersMarkInTransit = distributorProcedure
  .input(markInTransitSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, notes } = input;
    const { partnerId, user } = ctx;

    // Fetch the order
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId, distributorId: partnerId },
    });

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found or not assigned to you',
      });
    }

    // Validate order status - must be delivery_scheduled
    if (order.status !== 'delivery_scheduled') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot mark as in transit. Order must be in "delivery_scheduled" status, current status is "${order.status}"`,
      });
    }

    const now = new Date();

    // Update order status
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set({
        status: 'out_for_delivery',
        outForDeliveryAt: now,
        outForDeliveryBy: user.id,
        deliveryNotes: notes ?? order.deliveryNotes,
        updatedAt: now,
      })
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId,
      action: 'marked_in_transit',
      previousStatus: order.status,
      newStatus: 'out_for_delivery',
      notes: notes ?? 'Order dispatched for delivery',
    });

    // Notify partner
    if (order.partnerId) {
      const partnerMembersList = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.partnerId));

      for (const member of partnerMembersList) {
        await createNotification({
          userId: member.userId,
          type: 'status_update',
          title: 'Order In Transit',
          message: `Order ${updatedOrder?.orderNumber ?? orderId} is now out for delivery to your client`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/private-orders/${orderId}`,
        });
      }
    }

    return updatedOrder;
  });

export default ordersMarkInTransit;
