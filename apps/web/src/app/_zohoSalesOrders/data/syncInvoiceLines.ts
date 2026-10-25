import { eq, inArray } from 'drizzle-orm';

import { zohoInvoiceLineItems, zohoInvoiceLineSync } from '@/database/schema';
import { getInvoice } from '@/lib/zoho/invoices';

/**
 * Read the lines of Zoho invoices that are new or changed since last read
 *
 * The list endpoint returns no lines, so each invoice is fetched once per
 * version, its lines replaced, and the version recorded. Capped per run to
 * stay inside Zoho's rate limit: the backlog fills over successive runs.
 * Failures are counted and returned for the log, never thrown, so the invoice sync itself is never
 * held up by it.
 *
 * @param input.invoices - Invoices from the list, with their last-modified stamp
 * @param input.db - Database handle (the Trigger.dev one inside a job)
 * @param input.limit - Most invoices to fetch this run
 * @returns How many were read, failed, and are still waiting
 */
const syncInvoiceLines = async ({
  invoices,
  db,
  limit = 20,
}: {
  invoices: { invoiceId: string; invoiceNumber: string; lastModified: string | null }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  limit?: number;
}) => {
  if (invoices.length === 0) return { read: 0, failed: 0, waiting: 0 };

  const known: { zohoInvoiceId: string; lastModified: string | null }[] = await db
    .select({ zohoInvoiceId: zohoInvoiceLineSync.zohoInvoiceId, lastModified: zohoInvoiceLineSync.lastModified })
    .from(zohoInvoiceLineSync)
    .where(
      inArray(
        zohoInvoiceLineSync.zohoInvoiceId,
        invoices.map((inv) => inv.invoiceId),
      ),
    );
  const versionOf = new Map(known.map((row) => [row.zohoInvoiceId, row.lastModified]));

  const due = invoices.filter(
    (inv) => !versionOf.has(inv.invoiceId) || (inv.lastModified && versionOf.get(inv.invoiceId) !== inv.lastModified),
  );

  let read = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const inv of due.slice(0, limit)) {
    try {
      const detail = await getInvoice(inv.invoiceId);
      const lines = detail.line_items ?? [];

      await db.transaction(async (tx: typeof db) => {
        await tx.delete(zohoInvoiceLineItems).where(eq(zohoInvoiceLineItems.zohoInvoiceId, inv.invoiceId));
        if (lines.length > 0) {
          await tx.insert(zohoInvoiceLineItems).values(
            lines.map((line, index) => ({
              zohoInvoiceId: inv.invoiceId,
              invoiceNumber: inv.invoiceNumber,
              zohoLineItemId: line.line_item_id ?? null,
              lineOrder: line.item_order ?? index,
              itemType: line.item_type ?? null,
              zohoItemId: line.item_id ?? null,
              sku: line.sku ?? null,
              name: line.name ?? '',
              quantity: Number(line.quantity) || 0,
              unit: line.unit ?? null,
              rate: Number(line.rate) || 0,
              itemTotal: line.item_total ?? null,
              zohoSalesorderId: detail.salesorder_id ?? null,
              zohoSalesorderItemId: line.salesorder_item_id ?? null,
            })),
          );
        }
        await tx
          .insert(zohoInvoiceLineSync)
          .values({
            zohoInvoiceId: inv.invoiceId,
            lastModified: inv.lastModified ?? detail.last_modified_time ?? null,
            zohoSalesorderId: detail.salesorder_id ?? null,
            zohoSalesorderNumber: detail.salesorder_number ?? null,
            syncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: zohoInvoiceLineSync.zohoInvoiceId,
            set: {
              lastModified: inv.lastModified ?? detail.last_modified_time ?? null,
              zohoSalesorderId: detail.salesorder_id ?? null,
              zohoSalesorderNumber: detail.salesorder_number ?? null,
              syncedAt: new Date(),
            },
          });
      });
      read++;
      // Spaced out so this never competes with the order sync for Zoho's rate limit
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      failed++;
      errors.push(`${inv.invoiceNumber}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200));
    }
  }

  return { read, failed, waiting: Math.max(0, due.length - read), errors: errors.slice(0, 5) };
};

export default syncInvoiceLines;
