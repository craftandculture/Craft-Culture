import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import type { PrivateClientOrder } from '@/database/schema';
import { privateClientContacts, privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

import notifyPartnerOfOrderUpdate from '../utils/notifyPartnerOfOrderUpdate';

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
    let newStatus: PrivateClientOrder['status'];
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

    // If verified and order has a linked client, mark the client as verified
    if (response === 'verified' && order.clientId) {
      await db
        .update(privateClientContacts)
        .set({
          cityDrinksVerifiedAt: new Date(),
          cityDrinksVerifiedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(privateClientContacts.id, order.clientId));
    }

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
      if (response === 'verified') {
        // Notify partner that client is verified and payment can proceed
        await notifyPartnerOfOrderUpdate({
          orderId,
          orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
          partnerId: order.partnerId,
          type: 'client_verified',
          distributorName: distributor?.businessName ?? 'the distributor',
          paymentReference: paymentReference ?? undefined,
          totalAmount: order.totalUsd ?? undefined,
        });
      } else {
        // Notify partner that verification failed - they need to resolve
        await notifyPartnerOfOrderUpdate({
          orderId,
          orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
          partnerId: order.partnerId,
          type: 'verification_failed',
          distributorName: distributor?.businessName ?? 'the distributor',
          verificationNotes: notes,
        });
      }
    }

    return updatedOrder;
  });

export default ordersDistributorVerification;
