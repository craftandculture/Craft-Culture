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

const logContactAttemptSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().min(1, 'Please provide notes about the contact attempt'),
});

/**
 * Log a failed contact attempt for delivery scheduling
 *
 * When the distributor cannot reach the client to schedule delivery,
 * they log the attempt. This updates the partner with the latest status.
 */
const ordersLogContactAttempt = distributorProcedure
  .input(logContactAttemptSchema)
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

    // Validate order status - must be in payment or scheduling phase
    // Payment may complete before delivery, so accept payment statuses too
    const allowedStatuses = [
      'client_paid',
      'awaiting_distributor_payment',
      'distributor_paid',
      'awaiting_partner_payment',
      'partner_paid',
      'scheduling_delivery',
    ];
    if (!allowedStatuses.includes(order.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot log contact attempt for order with status "${order.status}"`,
      });
    }

    // Build the contact attempt entry
    const now = new Date();
    const newAttempt = {
      attemptedAt: now.toISOString(),
      attemptedBy: user.id,
      notes,
    };

    // Get existing attempts or initialize empty array
    const existingAttempts = (order.deliveryContactAttempts as Array<{
      attemptedAt: string;
      attemptedBy: string;
      notes: string;
    }>) ?? [];

    // Update order with new contact attempt
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set({
        status: 'scheduling_delivery',
        deliveryContactAttempts: [...existingAttempts, newAttempt],
        updatedAt: now,
      })
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId,
      action: 'contact_attempt_logged',
      previousStatus: order.status,
      newStatus: 'scheduling_delivery',
      notes: `Contact attempt: ${notes}`,
      metadata: { attemptNumber: existingAttempts.length + 1 },
    });

    // Notify partner about the contact attempt
    if (order.partnerId) {
      const partnerMembersList = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.partnerId));

      for (const member of partnerMembersList) {
        await createNotification({
          userId: member.userId,
          partnerId: order.partnerId,
          type: 'status_update',
          title: 'Delivery Contact Attempt',
          message: `Distributor attempted to contact client for order ${updatedOrder?.orderNumber ?? orderId}: "${notes}"`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/private-orders/${orderId}`,
        });
      }
    }

    return updatedOrder;
  });

export default ordersLogContactAttempt;
