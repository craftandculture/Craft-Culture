import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { zohoInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Zoho invoices to link to an export job, searched by number or customer
 *
 * Reads the synced invoice list, so it answers instantly and needs no Zoho
 * call. With a Zoho customer on the job, that customer's invoices are listed
 * first; a search term looks across every customer.
 *
 * @example
 *   await trpcClient.logistics.admin.exports.searchZohoInvoices.query({ search: 'INV-0002' });
 */
const adminSearchZohoInvoices = adminProcedure
  .input(z.object({ search: z.string().trim().max(80).optional(), zohoCustomerId: z.string().nullable().optional() }))
  .query(async ({ input }) => {
    const term = input.search ? `%${input.search}%` : null;

    const where = term
      ? or(ilike(zohoInvoices.invoiceNumber, term), ilike(zohoInvoices.customerName, term), ilike(zohoInvoices.referenceNumber, term))
      : input.zohoCustomerId
        ? eq(zohoInvoices.zohoCustomerId, input.zohoCustomerId)
        : undefined;

    return db
      .select({
        zohoInvoiceId: zohoInvoices.zohoInvoiceId,
        invoiceNumber: zohoInvoices.invoiceNumber,
        customerName: zohoInvoices.customerName,
        zohoCustomerId: zohoInvoices.zohoCustomerId,
        invoiceDate: zohoInvoices.invoiceDate,
        total: zohoInvoices.total,
        currencyCode: zohoInvoices.currencyCode,
      })
      .from(zohoInvoices)
      .where(and(where, sql`${zohoInvoices.invoiceDate} > now() - interval '365 days'`))
      .orderBy(
        ...(input.zohoCustomerId
          ? [desc(sql`${zohoInvoices.zohoCustomerId} = ${input.zohoCustomerId}`)]
          : []),
        desc(zohoInvoices.invoiceDate),
        desc(zohoInvoices.invoiceNumber),
      )
      .limit(10);
  });

export default adminSearchZohoInvoices;
