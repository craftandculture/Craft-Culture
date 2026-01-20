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
import { protectedProcedure } from '@/lib/trpc/procedures';

const confirmPaymentSchema = z.object({
  orderId: z.string().uuid(),
  paymentStage: z.enum(['client', 'distributor', 'partner']),
  reference: z.string().optional(),
});

/**
 * Confirm a payment for a private client order
 *
 * Updates the payment timestamp and reference for the specified stage.
 * Also updates the order status to the next appropriate state.
 */
const paymentsConfirm = protectedProcedure.input(confirmPaymentSchema).mutation(async ({ input, ctx }) => {
  const { orderId, paymentStage, reference } = input;
  const { user } = ctx;

  // Verify order exists
  const order = await db.query.privateClientOrders.findFirst({
    where: { id: orderId },
  });

  if (!order) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Order not found',
    });
  }

  // Check access - must be admin or relevant party
  const isAdmin = user.role === 'admin';

  // Check if user is a member of the partner that owns this order
  const [userPartnerMembership] = await db
    .select({ partnerId: partnerMembers.partnerId })
    .from(partnerMembers)
    .where(eq(partnerMembers.userId, user.id))
    .limit(1);

  const isPartner = userPartnerMembership && order.partnerId === userPartnerMembership.partnerId;

  // Validate permissions based on payment stage
  if (paymentStage === 'client') {
    // Only partner or admin can confirm client payment
    if (!isAdmin && !isPartner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the partner or admin can confirm client payment',
      });
    }
  } else if (paymentStage === 'distributor' || paymentStage === 'partner') {
    // Only admin can confirm distributor and partner payments
    if (!isAdmin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only admin can confirm this payment',
      });
    }
  }

  // Build update object based on payment stage
  const now = new Date();
  type UpdateFields = {
    clientPaidAt?: Date;
    clientPaymentConfirmedBy?: string;
    clientPaymentReference?: string;
    distributorPaidAt?: Date;
    distributorPaymentConfirmedBy?: string;
    distributorPaymentReference?: string;
    partnerPaidAt?: Date;
    partnerPaymentConfirmedBy?: string;
    partnerPaymentReference?: string;
    status?: typeof order.status;
  };

  const updateData: UpdateFields = {};

  switch (paymentStage) {
    case 'client':
      if (order.clientPaidAt) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Client payment already confirmed',
        });
      }
      updateData.clientPaidAt = now;
      updateData.clientPaymentConfirmedBy = user.id;
      if (reference) {
        updateData.clientPaymentReference = reference;
      }
      // Partner confirms payment received - now needs distributor verification
      updateData.status = 'awaiting_payment_verification';
      break;

    case 'distributor':
      if (order.distributorPaidAt) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Distributor payment already confirmed',
        });
      }
      updateData.distributorPaidAt = now;
      updateData.distributorPaymentConfirmedBy = user.id;
      if (reference) {
        updateData.distributorPaymentReference = reference;
      }
      updateData.status = 'distributor_paid';
      break;

    case 'partner':
      if (order.partnerPaidAt) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Partner payment already confirmed',
        });
      }
      updateData.partnerPaidAt = now;
      updateData.partnerPaymentConfirmedBy = user.id;
      if (reference) {
        updateData.partnerPaymentReference = reference;
      }
      updateData.status = 'partner_paid';
      break;
  }

  // Update order
  const [updatedOrder] = await db
    .update(privateClientOrders)
    .set(updateData)
    .where(eq(privateClientOrders.id, orderId))
    .returning();

  // Log activity and send notifications for client payment confirmation
  if (paymentStage === 'client' && updatedOrder) {
    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId: order.partnerId,
      action: 'payment_confirmed_by_partner',
      previousStatus: order.status,
      newStatus: 'awaiting_payment_verification',
      notes: 'Partner confirmed client payment received. Awaiting distributor verification.',
    });

    // Get partner name for notification
    const partner = order.partnerId
      ? await db.query.partners.findFirst({
          where: { id: order.partnerId },
          columns: { businessName: true },
        })
      : null;

    // Notify distributor members to verify the payment
    if (order.distributorId) {
      const distributorMembers = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.distributorId));

      for (const member of distributorMembers) {
        await createNotification({
          userId: member.userId,
          partnerId: order.distributorId,
          type: 'action_required',
          title: 'Payment Verification Required',
          message: `${partner?.businessName ?? 'Partner'} confirmed client payment for order ${updatedOrder.orderNumber}. Please verify and schedule delivery.`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/distributor/orders/${orderId}`,
        });
      }
    }
  }

  return updatedOrder;
});

export default paymentsConfirm;
