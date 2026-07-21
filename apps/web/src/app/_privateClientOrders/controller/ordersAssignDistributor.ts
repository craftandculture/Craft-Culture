import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import type { PrivateClientOrder } from '@/database/schema';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import notifyDistributorOfOrderUpdate from '../utils/notifyDistributorOfOrderUpdate';
import notifyPartnerOfOrderUpdate from '../utils/notifyPartnerOfOrderUpdate';

const assignDistributorSchema = z.object({
  orderId: z.string().uuid(),
  distributorId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Assign a distributor to a private client order
 *
 * Admin assigns a distributor partner to handle delivery of an approved order.
 */
const ordersAssignDistributor = wmsOperatorProcedure.input(assignDistributorSchema).mutation(async ({ input, ctx }) => {
  const { orderId, distributorId, notes } = input;
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

  // Validate current status allows distributor assignment
  const validStatuses = ['cc_approved', 'awaiting_client_payment', 'client_paid'];
  if (!validStatuses.includes(order.status)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot assign distributor to order with status "${order.status}". Order must be approved first.`,
    });
  }

  // Verify the distributor exists and is a distributor type partner
  const distributor = await db.query.partners.findFirst({
    where: { id: distributorId },
    columns: {
      id: true,
      businessName: true,
      type: true,
      requiresClientVerification: true,
      distributorCode: true,
    },
  });

  if (!distributor) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Distributor not found',
    });
  }

  if (distributor.type !== 'distributor') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Selected partner is not a distributor',
    });
  }

  // Check whether the client is already verified (e.g. from a prior order).
  // A verified client should not be sent through the verification handshake again.
  let clientAlreadyVerified = false;
  if (order.clientId) {
    const client = await db.query.privateClientContacts.findFirst({
      where: { id: order.clientId },
      columns: { cityDrinksVerifiedAt: true },
    });
    clientAlreadyVerified = !!client?.cityDrinksVerifiedAt;
  }

  // C&C acts as its own partner on some orders, so there's no external partner
  // to run the client-verification handshake. Detect that so we can skip the
  // awaiting_partner_verification step and record C&C as the verifier.
  const orderPartner = order.partnerId
    ? await db.query.partners.findFirst({
        where: { id: order.partnerId },
        columns: { businessName: true },
      })
    : null;
  const partnerIsCraftCulture =
    orderPartner?.businessName?.trim().toLowerCase() === 'craft & culture';

  // Determine the new status based on whether verification is still needed
  const previousStatus = order.status;
  let newStatus: PrivateClientOrder['status'];
  let paymentReference: string | null = null;
  let autoPartnerVerified = false;

  if (distributor.requiresClientVerification && !clientAlreadyVerified) {
    if (partnerIsCraftCulture) {
      // No external partner to verify — auto-pass straight to distributor verification.
      newStatus = 'awaiting_distributor_verification';
      autoPartnerVerified = true;
    } else {
      // Distributor requires verification and client isn't verified yet - prompt partner first
      newStatus = 'awaiting_partner_verification';
    }
  } else {
    // No verification required, or client already verified - proceed directly to payment
    newStatus = 'awaiting_client_payment';
    // Generate payment reference: {distributorCode}-{orderNumber}
    paymentReference = `${distributor.distributorCode ?? 'ORD'}-${order.orderNumber}`;
  }

  // Update order with distributor and new status
  const [updatedOrder] = await db
    .update(privateClientOrders)
    .set({
      distributorId,
      distributorAssignedAt: new Date(),
      status: newStatus,
      paymentReference,
      ...(autoPartnerVerified && {
        partnerVerificationResponse: 'yes',
        partnerVerificationAt: new Date(),
        partnerVerificationBy: user.id,
      }),
      updatedAt: new Date(),
    })
    .where(eq(privateClientOrders.id, orderId))
    .returning();

  // Log the activity
  await db.insert(privateClientOrderActivityLogs).values({
    orderId,
    userId: user.id,
    action: 'distributor_assigned',
    previousStatus,
    newStatus,
    notes: notes ?? `Assigned to ${distributor.businessName}`,
    metadata: { distributorId, distributorName: distributor.businessName },
  });

  // Send notifications based on the flow
  if (newStatus === 'awaiting_partner_verification' && order.partnerId) {
    // Notify partner to verify client with distributor
    await notifyPartnerOfOrderUpdate({
      orderId,
      orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
      partnerId: order.partnerId,
      type: 'verification_required',
      distributorName: distributor.businessName ?? 'the distributor',
    });
  } else if (autoPartnerVerified) {
    // C&C auto-verified as partner — notify the distributor to verify the client
    await notifyDistributorOfOrderUpdate({
      orderId,
      orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
      distributorId,
      type: 'verification_required',
      clientName: order.clientName ?? undefined,
      clientEmail: order.clientEmail ?? undefined,
      clientPhone: order.clientPhone ?? undefined,
    });
  } else {
    // Notify distributor members about the new order (with link to download PDF)
    await notifyDistributorOfOrderUpdate({
      orderId,
      orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
      distributorId,
      type: 'order_assigned',
      clientName: order.clientName ?? undefined,
      paymentReference: paymentReference ?? undefined,
      totalAmount: order.totalUsd ?? undefined,
    });
  }

  return updatedOrder;
});

export default ordersAssignDistributor;
