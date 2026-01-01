import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
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

  const userPartner = await db.query.partners.findFirst({
    where: { userId: user.id },
    columns: { id: true },
  });

  const isPartner = userPartner && order.partnerId === userPartner.id;
  const _isDistributor = userPartner && order.distributorId === userPartner.id;

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
      if (reference) updateData.clientPaymentReference = reference;
      updateData.status = 'client_paid';
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
      if (reference) updateData.distributorPaymentReference = reference;
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
      if (reference) updateData.partnerPaymentReference = reference;
      updateData.status = 'partner_paid';
      break;
  }

  // Update order
  const [updatedOrder] = await db
    .update(privateClientOrders)
    .set(updateData)
    .where(eq(privateClientOrders.id, orderId))
    .returning();

  return updatedOrder;
});

export default paymentsConfirm;
