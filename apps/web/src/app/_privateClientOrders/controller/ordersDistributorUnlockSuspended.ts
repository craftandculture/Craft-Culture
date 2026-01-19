import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partnerMembers, privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

const unlockSuspendedSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Distributor unlocks a suspended order after client is verified
 *
 * When an order is in verification_suspended status, the distributor
 * can unlock it once they confirm the client is now registered in their system.
 * This moves the order directly to awaiting_client_payment.
 */
const ordersDistributorUnlockSuspended = distributorProcedure
  .input(unlockSuspendedSchema)
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
    if (order.status !== 'verification_suspended') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot unlock order with status "${order.status}". Order must be in verification suspended status.`,
      });
    }

    // Get distributor info for payment reference
    const distributor = await db.query.partners.findFirst({
      where: { id: distributorId },
      columns: { id: true, businessName: true, distributorCode: true },
    });

    const previousStatus = order.status;
    const newStatus = 'awaiting_client_payment' as const;
    // Generate payment reference: {distributorCode}-{orderNumber}
    const paymentReference = `${distributor?.distributorCode ?? 'ORD'}-${order.orderNumber}`;

    // Update order
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set({
        status: newStatus,
        distributorVerificationResponse: 'verified',
        distributorVerificationAt: new Date(),
        distributorVerificationBy: user.id,
        distributorVerificationNotes: notes ?? 'Client verified after suspension',
        paymentReference,
        updatedAt: new Date(),
      })
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId: distributorId,
      action: 'verification_unlocked',
      previousStatus,
      newStatus,
      notes: `Suspended order unlocked. Client now verified. Payment reference: ${paymentReference}`,
      metadata: { unlockedBy: 'distributor' },
    });

    // Notify partner that order is unlocked and payment can proceed
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
          title: 'Order Unlocked',
          message: `Order ${updatedOrder?.orderNumber ?? orderId} has been unlocked by ${distributor?.businessName ?? 'distributor'}. Client verified. Payment reference: ${paymentReference}.`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/private-orders/${orderId}`,
        });
      }
    }

    return updatedOrder;
  });

export default ordersDistributorUnlockSuspended;
