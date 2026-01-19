import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners, privateClientOrderItems } from '@/database/schema';
import loops from '@/lib/loops/client';
import { distributorProcedure } from '@/lib/trpc/procedures';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import renderProformaInvoicePDF from '../utils/renderProformaInvoicePDF';

const DISTRIBUTOR_TEMPLATE_ID = 'cmkj88ybu0hm20izqhu21bqd5'; // order_assigned template

/**
 * Resend proforma invoice to finance email
 *
 * Allows distributors to manually resend the proforma invoice PDF
 * to their finance department for a specific order.
 */
const distributorResendProformaInvoice = distributorProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { orderId } = input;
    const { partnerId } = ctx;

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

    // Verify this order is assigned to the requesting distributor
    if (order.distributorId !== partnerId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this order',
      });
    }

    // Get distributor details
    const [distributor] = await db
      .select({
        businessName: partners.businessName,
        financeEmail: partners.financeEmail,
      })
      .from(partners)
      .where(eq(partners.id, partnerId));

    if (!distributor?.financeEmail) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No finance email configured. Please set a finance email in your distributor settings.',
      });
    }

    // Fetch line items
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
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderProformaInvoicePDF({
        order: {
          orderNumber: order.orderNumber ?? orderId,
          createdAt: order.createdAt,
          paymentReference: order.paymentReference,
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
    } catch (pdfError) {
      logger.error('PCO: Failed to generate proforma invoice PDF for resend', {
        orderId,
        error: pdfError instanceof Error ? pdfError.message : String(pdfError),
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate PDF',
      });
    }

    // Format total for display
    const totalFormatted = order.totalUsd
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(order.totalUsd)
      : undefined;

    const orderUrl = `${serverConfig.appUrl}/platform/distributor/orders/${orderId}`;

    // Send email via Loops
    try {
      logger.info('PCO: Resending proforma invoice to finance', {
        templateId: DISTRIBUTOR_TEMPLATE_ID,
        email: distributor.financeEmail,
        orderId,
        orderNumber: order.orderNumber,
      });

      const result = await loops.sendTransactionalEmail({
        transactionalId: DISTRIBUTOR_TEMPLATE_ID,
        email: distributor.financeEmail,
        dataVariables: {
          distributorName: distributor.businessName ?? 'Distributor',
          orderNumber: order.orderNumber ?? orderId,
          orderUrl,
          partnerName: partner?.businessName ?? '',
          clientName: order.clientName ?? '',
          clientEmail: order.clientEmail ?? '',
          clientPhone: order.clientPhone ?? '',
          paymentReference: order.paymentReference ?? '',
          totalAmount: totalFormatted ?? '',
          totalAmountUSD: totalFormatted ?? '',
        },
        attachments: [
          {
            filename: `Proforma-Invoice-${order.orderNumber ?? orderId}.pdf`,
            contentType: 'application/pdf',
            data: pdfBuffer.toString('base64'),
          },
        ],
      });

      logger.info('PCO: Proforma invoice resent successfully', {
        email: distributor.financeEmail,
        orderId,
        result: JSON.stringify(result),
        success: result?.success,
      });

      return {
        success: true,
        email: distributor.financeEmail,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('PCO: Failed to resend proforma invoice', {
        email: distributor.financeEmail,
        orderId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to send email: ${errorMessage}`,
      });
    }
  });

export default distributorResendProformaInvoice;
