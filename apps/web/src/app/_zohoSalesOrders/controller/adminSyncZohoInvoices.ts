import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { zohoInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { listInvoices } from '@/lib/zoho/invoices';

/**
 * Sync all invoices from Zoho Books into the zohoInvoices table.
 * Paginates through all invoices and upserts each one.
 *
 * @example
 *   await trpcClient.zohoSalesOrders.syncInvoices.mutate();
 */
const adminSyncZohoInvoices = adminProcedure.mutation(async () => {
  if (!isZohoConfigured()) {
    return { created: 0, updated: 0, total: 0, message: 'Zoho not configured' };
  }

  let created = 0;
  let updated = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await listInvoices({ page, perPage: 200 });

    for (const inv of result.invoices) {
      // Skip draft and void invoices
      if (inv.status === 'draft' || inv.status === 'void') continue;

      const [existing] = await db
        .select({ id: zohoInvoices.id })
        .from(zohoInvoices)
        .where(eq(zohoInvoices.zohoInvoiceId, inv.invoice_id))
        .limit(1);

      const now = new Date();

      if (existing) {
        await db
          .update(zohoInvoices)
          .set({
            invoiceNumber: inv.invoice_number,
            customerName: inv.customer_name,
            status: inv.status,
            invoiceDate: new Date(inv.date),
            dueDate: inv.due_date ? new Date(inv.due_date) : null,
            referenceNumber: inv.reference_number ?? null,
            subTotal: inv.sub_total,
            total: inv.total,
            balance: inv.balance,
            currencyCode: inv.currency_code,
            lastSyncAt: now,
            updatedAt: now,
          })
          .where(eq(zohoInvoices.id, existing.id));
        updated++;
      } else {
        await db.insert(zohoInvoices).values({
          zohoInvoiceId: inv.invoice_id,
          invoiceNumber: inv.invoice_number,
          zohoCustomerId: inv.customer_id,
          customerName: inv.customer_name,
          status: inv.status,
          invoiceDate: new Date(inv.date),
          dueDate: inv.due_date ? new Date(inv.due_date) : null,
          referenceNumber: inv.reference_number ?? null,
          subTotal: inv.sub_total,
          total: inv.total,
          balance: inv.balance,
          currencyCode: inv.currency_code,
          lastSyncAt: now,
        });
        created++;
      }
    }

    hasMore = result.pageContext.has_more_page;
    page++;
  }

  const total = created + updated;

  return {
    created,
    updated,
    total,
    message: `Synced ${total} invoices (${created} new, ${updated} updated)`,
  };
});

export default adminSyncZohoInvoices;
