import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { exportInvoiceSources, exportInvoices, zohoInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * A consignee's invoices, marked with any export invoice already covering them
 *
 * Voided and draft invoices never reach the synced table, so what is listed is
 * what can be exported. Invoices already on an issued export invoice are shown
 * but marked, since re-exporting one is nearly always a mistake.
 */
const adminListInvoicesForConsignee = adminProcedure
  .input(z.object({ zohoCustomerId: z.string() }))
  .query(async ({ input }) => {
    const invoices = await db
      .select({
        zohoInvoiceId: zohoInvoices.zohoInvoiceId,
        invoiceNumber: zohoInvoices.invoiceNumber,
        invoiceDate: zohoInvoices.invoiceDate,
        referenceNumber: zohoInvoices.referenceNumber,
        subject: zohoInvoices.subject,
        total: zohoInvoices.total,
        currencyCode: zohoInvoices.currencyCode,
      })
      .from(zohoInvoices)
      .where(
        and(
          eq(zohoInvoices.zohoCustomerId, input.zohoCustomerId),
          sql`${zohoInvoices.invoiceDate} > now() - interval '120 days'`,
        ),
      )
      .orderBy(desc(zohoInvoices.invoiceDate), desc(zohoInvoices.invoiceNumber));

    const covered = await db
      .select({
        zohoInvoiceId: exportInvoiceSources.zohoInvoiceId,
        number: exportInvoices.number,
        status: exportInvoices.status,
      })
      .from(exportInvoiceSources)
      .innerJoin(exportInvoices, eq(exportInvoices.id, exportInvoiceSources.exportInvoiceId))
      .where(eq(exportInvoices.zohoCustomerId, input.zohoCustomerId));

    return invoices.map((inv) => {
      const on = covered.filter((c) => c.zohoInvoiceId === inv.zohoInvoiceId);
      return {
        ...inv,
        issuedOn: on.find((c) => c.status === 'issued')?.number ?? null,
        inDraft: on.some((c) => c.status === 'draft'),
      };
    });
  });

export default adminListInvoicesForConsignee;
