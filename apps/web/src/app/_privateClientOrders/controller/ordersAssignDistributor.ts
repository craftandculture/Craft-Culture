import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import type { PrivateClientOrder } from '@/database/schema';
import { partners, privateClientOrderActivityLogs, privateClientOrderItems, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import notifyDistributorOfOrderUpdate from '../utils/notifyDistributorOfOrderUpdate';
import notifyPartnerOfOrderUpdate from '../utils/notifyPartnerOfOrderUpdate';
import renderProformaInvoicePDF from '../utils/renderProformaInvoicePDF';

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
const ordersAssignDistributor = adminProcedure.input(assignDistributorSchema).mutation(async ({ input, ctx }) => {
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

  // Determine the new status based on whether distributor requires verification
  const previousStatus = order.status;
  let newStatus: PrivateClientOrder['status'];
  let paymentReference: string | null = null;

  if (distributor.requiresClientVerification) {
    // Distributor requires verification - prompt partner first
    newStatus = 'awaiting_partner_verification';
  } else {
    // No verification required - proceed directly to payment
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
  if (distributor.requiresClientVerification && order.partnerId) {
    // Notify partner to verify client with distributor
    await notifyPartnerOfOrderUpdate({
      orderId,
      orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
      partnerId: order.partnerId,
      type: 'verification_required',
      distributorName: distributor.businessName ?? 'the distributor',
    });
  } else {
    // Fetch line items for PDF
    const lineItems = await db
      .select()
      .from(privateClientOrderItems)
      .where(eq(privateClientOrderItems.orderId, orderId));

    // Fetch partner details if available
    let partner: { businessName: string; businessEmail: string | null; businessPhone: string | null } | null = null;
    if (order.partnerId) {
      const [partnerResult] = await db
        .select({
          businessName: partners.businessName,
          businessEmail: partners.businessEmail,
          businessPhone: partners.businessPhone,
        })
        .from(partners)
        .where(eq(partners.id, order.partnerId));
      partner = partnerResult ?? null;
    }

    // Generate proforma invoice PDF
    let pdfAttachment: { filename: string; data: string } | undefined;
    try {
      const pdfBuffer = await renderProformaInvoicePDF({
        order: {
          orderNumber: order.orderNumber ?? orderId,
          createdAt: order.createdAt,
          paymentReference,
          clientName: order.clientName ?? 'Client',
          clientEmail: order.clientEmail,
          clientPhone: order.clientPhone,
          clientAddress: order.clientAddress,
          deliveryNotes: order.deliveryNotes,
          subtotalUsd: order.subtotalUsd,
          dutyUsd: order.dutyUsd,
          vatUsd: order.vatUsd,
          logisticsUsd: order.logisticsUsd,
          totalUsd: order.totalUsd ?? 0,
        },
        lineItems: lineItems.map((item) => ({
          productName: item.productName ?? 'Unknown Product',
          producer: item.producer,
          vintage: item.vintage,
          region: item.region,
          bottleSize: item.bottleSize,
          quantity: item.quantity ?? 0,
          pricePerCaseUsd: item.pricePerCaseUsd,
          totalUsd: item.totalUsd,
        })),
        partner,
        distributor: { businessName: distributor.businessName ?? 'Distributor' },
      });

      pdfAttachment = {
        filename: `Proforma-Invoice-${order.orderNumber ?? orderId}.pdf`,
        data: pdfBuffer.toString('base64'),
      };

      logger.info('PCO: Generated proforma invoice PDF', {
        orderId,
        orderNumber: order.orderNumber,
        pdfSize: pdfBuffer.length,
      });
    } catch (pdfError) {
      logger.error('PCO: Failed to generate proforma invoice PDF', {
        orderId,
        error: pdfError instanceof Error ? pdfError.message : String(pdfError),
      });
      // Continue without PDF attachment - don't fail the whole operation
    }

    // Notify distributor members about the new order
    await notifyDistributorOfOrderUpdate({
      orderId,
      orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
      distributorId,
      type: 'order_assigned',
      clientName: order.clientName ?? undefined,
      paymentReference: paymentReference ?? undefined,
      totalAmount: order.totalUsd ?? undefined,
      pdfAttachment,
    });
  }

  return updatedOrder;
});

export default ordersAssignDistributor;
