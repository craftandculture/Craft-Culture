import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import { getInvoice, getInvoicePdf } from '@/lib/zoho/invoices';
import logger from '@/utils/logger';

import getMemberZohoCustomer from '../data/getMemberZohoCustomer';

/**
 * One of the member's invoices as Zoho's PDF, base64-encoded
 *
 * The invoice is fetched first and checked to belong to the member's own Zoho
 * customer, so an invoice id from anywhere else gets nothing. Drafts and voids
 * are refused for the same reason the list leaves them out.
 *
 * @example
 *   const { fileName, base64 } =
 *     await trpcClient.cellar.member.getInvoicePdf.query({ invoiceId });
 */
const memberGetInvoicePdf = stockOwnerProcedure
  .input(z.object({ invoiceId: z.string().regex(/^\d+$/) }))
  .query(async ({ ctx, input }) => {
    if (ctx.cellarRole === 'viewer') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Invoices are shown to the cellar holder.',
      });
    }

    const customerId = await getMemberZohoCustomer(ctx.partner.id);

    const invoice = customerId
      ? await getInvoice(input.invoiceId).catch((error: unknown) => {
          logger.error('Could not read a member’s invoice from Zoho', {
            partnerId: ctx.partner.id,
            invoiceId: input.invoiceId,
            error,
          });
          return null;
        })
      : null;

    if (
      !invoice ||
      invoice.customer_id !== customerId ||
      invoice.status === 'draft' ||
      invoice.status === 'void'
    ) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found.' });
    }

    const pdf = await getInvoicePdf(invoice.invoice_id);

    return {
      fileName: `${invoice.invoice_number}.pdf`,
      base64: pdf.toString('base64'),
    };
  });

export default memberGetInvoicePdf;
