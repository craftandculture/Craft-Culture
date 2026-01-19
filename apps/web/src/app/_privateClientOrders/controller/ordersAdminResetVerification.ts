import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partnerMembers, privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const adminResetSchema = z.object({
  orderId: z.string().uuid(),
  targetStatus: z.enum([
    'awaiting_partner_verification',
    'awaiting_distributor_verification',
    'awaiting_client_payment',
  ]),
  notes: z.string().optional(),
});

/**
 * Admin resets a suspended order to continue the flow
 *
 * C&C override capability - admin can reset a verification_suspended order
 * to any point in the verification/payment flow:
 * - awaiting_partner_verification: Restart from partner verification
 * - awaiting_distributor_verification: Skip to distributor verification
 * - awaiting_client_payment: Skip verification entirely, proceed to payment
 */
const ordersAdminResetVerification = adminProcedure
  .input(adminResetSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, targetStatus, notes } = input;
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

    // Validate current status - only allow reset from suspended
    if (order.status !== 'verification_suspended') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot reset order with status "${order.status}". Order must be in verification suspended status.`,
      });
    }

    if (!order.distributorId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Order has no distributor assigned',
      });
    }

    // Get distributor info for payment reference if needed
    const distributor = await db.query.partners.findFirst({
      where: { id: order.distributorId },
      columns: { id: true, businessName: true, distributorCode: true },
    });

    const previousStatus = order.status;
    let paymentReference: string | null = null;

    // If going to payment, generate payment reference
    if (targetStatus === 'awaiting_client_payment') {
      paymentReference = `${distributor?.distributorCode ?? 'ORD'}-${order.orderNumber}`;
    }

    // Update order
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set({
        status: targetStatus,
        paymentReference,
        // Clear verification fields if resetting to earlier stage
        ...(targetStatus === 'awaiting_partner_verification' && {
          partnerVerificationResponse: null,
          partnerVerificationAt: null,
          partnerVerificationBy: null,
          distributorVerificationResponse: null,
          distributorVerificationAt: null,
          distributorVerificationBy: null,
          distributorVerificationNotes: null,
        }),
        ...(targetStatus === 'awaiting_distributor_verification' && {
          distributorVerificationResponse: null,
          distributorVerificationAt: null,
          distributorVerificationBy: null,
          distributorVerificationNotes: null,
        }),
        ...(targetStatus === 'awaiting_client_payment' && {
          distributorVerificationResponse: 'verified',
          distributorVerificationAt: new Date(),
          distributorVerificationBy: user.id,
          distributorVerificationNotes: 'Admin override - verification bypassed',
        }),
        updatedAt: new Date(),
      })
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      action: 'admin_verification_reset',
      previousStatus,
      newStatus: targetStatus,
      notes: notes ?? `Admin reset order to ${targetStatus}`,
      metadata: { resetBy: 'admin', targetStatus },
    });

    // Send notifications based on target status
    if (targetStatus === 'awaiting_partner_verification' && order.partnerId) {
      // Notify partner to verify again
      const partnerMembersList = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.partnerId));

      for (const member of partnerMembersList) {
        await createNotification({
          userId: member.userId,
          partnerId: order.partnerId,
          type: 'action_required',
          title: 'Verification Reset',
          message: `Order ${updatedOrder?.orderNumber ?? orderId} has been reset by C&C. Please verify client with ${distributor?.businessName ?? 'distributor'}.`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/private-orders/${orderId}`,
        });
      }
    } else if (targetStatus === 'awaiting_distributor_verification') {
      // Notify distributor to verify
      const distributorMembers = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.distributorId));

      for (const member of distributorMembers) {
        await createNotification({
          userId: member.userId,
          partnerId: order.distributorId,
          type: 'action_required',
          title: 'Client Verification Required',
          message: `C&C has reset order ${updatedOrder?.orderNumber ?? orderId}. Please verify client in your system.`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/distributor/orders/${orderId}`,
        });
      }
    } else if (targetStatus === 'awaiting_client_payment' && order.partnerId) {
      // Notify partner that verification was bypassed
      const partnerMembersList = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.partnerId));

      for (const member of partnerMembersList) {
        await createNotification({
          userId: member.userId,
          partnerId: order.partnerId,
          type: 'status_update',
          title: 'Order Unlocked by C&C',
          message: `Order ${updatedOrder?.orderNumber ?? orderId} has been unlocked by C&C. Payment reference: ${paymentReference}. Awaiting client payment.`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/private-orders/${orderId}`,
        });
      }
    }

    return updatedOrder;
  });

export default ordersAdminResetVerification;
