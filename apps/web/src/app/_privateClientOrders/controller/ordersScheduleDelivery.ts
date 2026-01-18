import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

import notifyPartnerOfOrderUpdate from '../utils/notifyPartnerOfOrderUpdate';

const scheduleDeliverySchema = z.object({
  orderId: z.string().uuid(),
  scheduledDate: z.string().datetime(),
  notes: z.string().optional(),
});

/**
 * Schedule delivery for a private client order
 *
 * Sets the delivery date after the distributor has contacted the client.
 * This moves the order to 'delivery_scheduled' status.
 */
const ordersScheduleDelivery = distributorProcedure
  .input(scheduleDeliverySchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, scheduledDate, notes } = input;
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

    // Validate order status - must be client_paid or scheduling_delivery
    if (
      order.status !== 'client_paid' &&
      order.status !== 'scheduling_delivery' &&
      order.status !== 'delivery_scheduled'
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot schedule delivery for order with status "${order.status}"`,
      });
    }

    const now = new Date();
    const deliveryDate = new Date(scheduledDate);

    // Update order with scheduled delivery
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set({
        status: 'delivery_scheduled',
        scheduledDeliveryDate: deliveryDate,
        scheduledDeliveryAt: now,
        scheduledDeliveryBy: user.id,
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
      action: 'delivery_scheduled',
      previousStatus: order.status,
      newStatus: 'delivery_scheduled',
      notes: notes ?? `Delivery scheduled for ${deliveryDate.toLocaleDateString()}`,
      metadata: { scheduledDate: deliveryDate.toISOString() },
    });

    // Notify partner about the scheduled delivery (in-app + email)
    if (order.partnerId) {
      await notifyPartnerOfOrderUpdate({
        orderId,
        orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
        partnerId: order.partnerId,
        type: 'delivery_scheduled',
        deliveryDate: deliveryDate.toLocaleDateString(),
      });
    }

    return updatedOrder;
  });

export default ordersScheduleDelivery;
