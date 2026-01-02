import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partnerMembers, privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

const distributorVerificationSchema = z.object({
  orderId: z.string().uuid(),
  response: z.enum(['verified', 'not_verified']),
  notes: z.string().optional(),
});

/**
 * Distributor verifies client in their system
 *
 * After partner confirms client is verified, the distributor
 * checks their system to confirm the client account.
 * - VERIFIED: Proceed to awaiting client payment
 * - NOT VERIFIED: Order suspended, partner needs to resolve
 */
const ordersDistributorVerification = distributorProcedure
  .input(distributorVerificationSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, response, notes } = input;
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
    if (order.status !== 'awaiting_distributor_verification') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot verify for order with status "${order.status}". Order must be awaiting distributor verification.`,
      });
    }

    // Get distributor info for payment reference
    const distributor = await db.query.partners.findFirst({
      where: { id: distributorId },
      columns: { id: true, businessName: true, distributorCode: true },
    });

    const previousStatus = order.status;
    let newStatus: string;
    let paymentReference: string | null = null;

    if (response === 'verified') {
      // Client verified - proceed to payment
      newStatus = 'awaiting_client_payment';
      // Generate payment reference: {distributorCode}-{orderNumber}
      paymentReference = `${distributor?.distributorCode ?? 'ORD'}-${order.orderNumber}`;
    } else {
      // Client not verified - suspend order
      newStatus = 'verification_suspended';
    }

    // Update order
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set({
        status: newStatus,
        distributorVerificationResponse: response,
        distributorVerificationAt: new Date(),
        distributorVerificationBy: user.id,
        distributorVerificationNotes: notes,
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
      action: 'distributor_verification',
      previousStatus,
      newStatus,
      notes:
        response === 'verified'
          ? `Client verified. Payment reference: ${paymentReference}`
          : `Client not verified: ${notes ?? 'No details provided'}`,
      metadata: { verificationResponse: response },
    });

    // Send notifications
    if (order.partnerId) {
      const partnerMembersList = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.partnerId));

      if (response === 'verified') {
        // Notify partner that client is verified and payment can proceed
        for (const member of partnerMembersList) {
          await createNotification({
            userId: member.userId,
            type: 'status_update',
            title: 'Client Verified',
            message: `Client verified for order ${updatedOrder?.orderNumber ?? orderId}. Payment reference: ${paymentReference}. Awaiting client payment.`,
            entityType: 'private_client_order',
            entityId: orderId,
            actionUrl: `/platform/private-orders/${orderId}`,
          });
        }
      } else {
        // Notify partner that verification failed - they need to resolve
        for (const member of partnerMembersList) {
          await createNotification({
            userId: member.userId,
            type: 'action_required',
            title: 'Client Verification Failed',
            message: `${distributor?.businessName ?? 'Distributor'} could not verify client for order ${updatedOrder?.orderNumber ?? orderId}. Please contact the client to resolve.`,
            entityType: 'private_client_order',
            entityId: orderId,
            actionUrl: `/platform/private-orders/${orderId}`,
          });
        }
      }
    }

    return updatedOrder;
  });

export default ordersDistributorVerification;
