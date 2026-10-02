import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';

import fetchInvoicesForExport from '../data/fetchInvoicesForExport';
import cleanDescription from '../utils/cleanDescription';
import parsePack from '../utils/parsePack';

/**
 * The lines of one invoice, live from Zoho, for checking before it is ticked
 *
 * Read the same way the draft will read them, so what is seen here is what
 * the export invoice will be built from.
 */
const adminGetInvoiceLines = adminProcedure
  .input(z.object({ zohoInvoiceId: z.string() }))
  .query(async ({ input }) => {
    if (!isZohoConfigured()) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Zoho is not configured on this environment.' });
    }
    try {
      const [invoice] = await fetchInvoicesForExport([input.zohoInvoiceId]);
      if (!invoice) throw new Error('Invoice not found');
      return {
        invoiceNumber: invoice.invoiceNumber,
        pcoNumber: invoice.pcoNumber,
        totalUsd: invoice.totalUsd,
        lines: invoice.lines.map((l) => {
          const pack = parsePack(`${l.description} ${l.name}`);
          return {
            id: l.lineItemId,
            description: cleanDescription(l.name),
            pack: pack ? `${pack.packBottles}x${pack.bottleSizeCl}cl` : '—',
            quantity: l.quantity,
            rate: l.rate,
            netUsd: l.netUsd,
            discounted: Math.abs(l.netUsd - l.rate * l.quantity) > 0.01,
            lwin18: l.lwin18,
          };
        }),
      };
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'Could not read the invoice from Zoho.',
      });
    }
  });

export default adminGetInvoiceLines;
