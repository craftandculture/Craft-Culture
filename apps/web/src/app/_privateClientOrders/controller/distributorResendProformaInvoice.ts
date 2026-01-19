import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners } from '@/database/schema';
import loops from '@/lib/loops/client';
import { distributorProcedure } from '@/lib/trpc/procedures';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

const FINANCE_PROFORMA_TEMPLATE_ID = 'cmklmzgr612b40ixqdeluo8qb'; // finance proforma template

/**
 * Resend proforma invoice notification to finance email
 *
 * Sends an email to the distributor's finance department with a link
 * to download the proforma invoice PDF for a specific order.
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
        message: 'No finance email configured. Please contact admin to set up finance email.',
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
    const pdfDownloadUrl = `${serverConfig.appUrl}/api/distributor/pco/proforma?orderId=${orderId}`;

    // Send email via Loops with download link
    try {
      logger.info('PCO: Sending proforma invoice notification to finance', {
        templateId: FINANCE_PROFORMA_TEMPLATE_ID,
        email: distributor.financeEmail,
        orderId,
        orderNumber: order.orderNumber,
        pdfDownloadUrl,
      });

      const result = await loops.sendTransactionalEmail({
        transactionalId: FINANCE_PROFORMA_TEMPLATE_ID,
        email: distributor.financeEmail,
        dataVariables: {
          distributorName: distributor.businessName ?? 'Distributor',
          orderNumber: order.orderNumber ?? orderId,
          orderUrl,
          pdfDownloadUrl,
          clientName: order.clientName ?? '',
          clientPhone: order.clientPhone ?? '',
          paymentReference: order.paymentReference ?? order.orderNumber ?? orderId,
          totalAmountUSD: totalFormatted ?? '',
        },
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
