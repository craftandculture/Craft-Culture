import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import {
  partnerMembers,
  privateClientOrderActivityLogs,
  privateClientOrders,
} from '@/database/schema';
import { approvedProcedure } from '@/lib/trpc/procedures';

import partnerOrderView from '../utils/partnerOrderView';
import isRoutinePcoTransition from '../utils/pcoStatusTransitions';
import resolveOrderParty from '../utils/resolveOrderParty';

const confirmPaymentSchema = z.object({
  orderId: z.string().uuid(),
  paymentStage: z.enum(['client', 'distributor', 'partner']),
  reference: z.string().optional(),
});

/**
 * Confirm a payment for a private client order
 *
 * Updates the payment timestamp and reference for the specified stage.
 * Also moves the order status on, but only when that is the routine next step.
 */
const paymentsConfirm = approvedProcedure.input(confirmPaymentSchema).mutation(async ({ input, ctx }) => {
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

  // C&C staff, or a member of the wine partner who placed it (not view-only)
  const { party, canWrite } = await resolveOrderParty(user, order);
  const isAdmin = party === 'staff';
  const isPartner = party === 'partner' && canWrite;

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
      // The client pays once the distributor has verified the client, so the
      // order must be waiting on that payment. Any other status would let the
      // partner skip verification (or reopen a finished order) by marking it
      // paid.
      if (order.status !== 'awaiting_client_payment') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot confirm client payment for an order with status "${order.status}". The order must be awaiting client payment.`,
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
      // Record the payment always, but only move the status on when it is the
      // next step; a delivered or cancelled order never goes backwards
      if (isRoutinePcoTransition(order.status, 'distributor_paid')) {
        updateData.status = 'distributor_paid';
      }
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
      // As adminMarkPartnerPaid: record the payout without regressing status
      if (isRoutinePcoTransition(order.status, 'partner_paid')) {
        updateData.status = 'partner_paid';
      }
      break;
  }

  // Update order, unless it moved on while this was being confirmed
  const [updatedOrder] = await db
    .update(privateClientOrders)
    .set(updateData)
    .where(and(eq(privateClientOrders.id, orderId), eq(privateClientOrders.status, order.status)))
    .returning();

  if (!updatedOrder) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'The order changed while you were confirming this payment. Refresh and try again.',
    });
  }

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

    // The distributor is never told which trade partner placed the order
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
          message: `Client payment confirmed for order ${updatedOrder.orderNumber}. Please verify and schedule delivery.`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/distributor/orders/${orderId}`,
        });
      }
    }
  }

  return isAdmin ? updatedOrder : partnerOrderView(updatedOrder);
});

export default paymentsConfirm;
