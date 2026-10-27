import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrderItems, privateClientOrders } from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';
import isVercelBlobUrl from '@/utils/isVercelBlobUrl';

import distributorOrderView from '../utils/distributorOrderView';
import ensureClientVerified from '../utils/ensureClientVerified';
import notifyPartnerOfOrderUpdate from '../utils/notifyPartnerOfOrderUpdate';


const markDeliveredSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().optional(),
  // Shown as an image to C&C and the partner, so only a file uploaded to our
  // own storage (or an inline image) is accepted, never an outside address
  signature: z
    .string()
    .refine((value) => isVercelBlobUrl(value) || /^data:image\/(png|jpeg|webp);base64,/.test(value), {
      message: 'The signature must be an uploaded image',
    })
    .optional(),
  photo: z
    .string()
    .refine((value) => isVercelBlobUrl(value), {
      message: 'The delivery photo must be uploaded first',
    })
    .optional(),
});

/**
 * Mark order as delivered
 *
 * The distributor marks the order as delivered when the client receives it.
 * This is the final step in the delivery flow.
 */
const ordersMarkDelivered = distributorProcedure
  .input(markDeliveredSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, notes, signature, photo } = input;
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

    // Validate order status - must be out_for_delivery
    if (order.status !== 'out_for_delivery') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot mark as delivered. Order must be "out_for_delivery", current status is "${order.status}"`,
      });
    }

    const now = new Date();

    // Update order status
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set({
        status: 'delivered',
        deliveredAt: now,
        deliveredConfirmedBy: user.id,
        deliveryNotes: notes ?? order.deliveryNotes,
        deliverySignature: signature ?? order.deliverySignature,
        deliveryPhoto: photo ?? order.deliveryPhoto,
        updatedAt: now,
      })
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    // Update all line items stock status to delivered
    await db
      .update(privateClientOrderItems)
      .set({
        stockStatus: 'delivered',
        updatedAt: now,
      })
      .where(eq(privateClientOrderItems.orderId, orderId));

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId,
      action: 'marked_delivered',
      previousStatus: order.status,
      newStatus: 'delivered',
      notes: notes ?? 'Order delivered successfully',
      metadata: {
        hasSignature: !!signature,
        hasPhoto: !!photo,
      },
    });

    // Ensure client contact is marked as CD-verified
    await ensureClientVerified(order.clientId);

    // Notify partner about successful delivery
    if (order.partnerId) {
      await notifyPartnerOfOrderUpdate({
        orderId,
        orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
        partnerId: order.partnerId,
        type: 'delivered',
        deliveryDate: now.toLocaleDateString('en-GB'),
      });
    }

    // Without C&C's own notes and its payment to the partner
    return updatedOrder ? distributorOrderView(updatedOrder) : updatedOrder;
  });

export default ordersMarkDelivered;
