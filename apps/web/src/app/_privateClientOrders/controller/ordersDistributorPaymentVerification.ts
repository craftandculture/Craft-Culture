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

const distributorPaymentVerificationSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Distributor verifies client payment received
 *
 * After partner confirms client paid, the distributor verifies
 * the payment in their system. This moves the order to 'client_paid'
 * status and allows delivery scheduling to proceed.
 */
const ordersDistributorPaymentVerification = distributorProcedure
  .input(distributorPaymentVerificationSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, notes } = input;
    const { partnerId: distributorId, user } = ctx;

    // Fetch the order
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId, distributorId },
    });

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found or not assigned to you',
      });
    }

    // Validate current status
    if (order.status !== 'awaiting_payment_verification') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot verify payment for order with status "${order.status}". Order must be awaiting payment verification.`,
      });
    }

    const previousStatus = order.status;
    const newStatus = 'client_paid';

    // Update order
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set({
        status: newStatus,
        distributorPaymentVerifiedAt: new Date(),
        distributorPaymentVerifiedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId: distributorId,
      action: 'payment_verified_by_distributor',
      previousStatus,
      newStatus,
      notes: notes ?? 'Distributor verified client payment. Ready for delivery scheduling.',
    });

    // Notify partner that payment is verified and delivery scheduling can begin
    if (order.partnerId) {
      const partnerMembersList = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.partnerId));

      for (const member of partnerMembersList) {
        await createNotification({
          userId: member.userId,
          type: 'status_update',
          title: 'Payment Verified',
          message: `Payment verified for order ${updatedOrder?.orderNumber ?? orderId}. Delivery scheduling will begin.`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/private-orders/${orderId}`,
        });
      }
    }

    return updatedOrder;
  });

export default ordersDistributorPaymentVerification;
