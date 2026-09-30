import { inArray } from 'drizzle-orm';

import { zohoInvoices } from '@/database/schema';

/** More than this many disappearing at once reads as a bad fetch, not deletions. */
const MAX_PRUNE = 25;

interface PruneParams {
  /** Every invoice id Zoho returned on this pass, whatever its status. */
  seenIds: Set<string>;
  /** Of those, the ones Zoho now reports as void. */
  voidIds: Set<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

/**
 * Drop invoices Zoho has voided or deleted since they were copied here.
 *
 * The sync only ever inserted and updated. An invoice voided after it synced
 * was skipped from then on, and a deleted one was simply never seen again, so
 * both froze at their last status — INV-000239 ($15,359.84) and INV-000338
 * ($887.06) sat in the C D General Trading balance as "overdue" long after
 * Zoho had removed them. Revenue totals here count every stored row, so a
 * void or deleted invoice has to leave the table, not linger in it.
 *
 * Call only after a pass has read EVERY page: an invoice missing from a
 * partial read has not been deleted. Refuses to remove more than MAX_PRUNE at
 * once for the same reason.
 *
 * @example
 *   await pruneZohoInvoices({ seenIds, voidIds, db });
 *   // { removed: 2, skipped: false }
 */
const pruneZohoInvoices = async ({ seenIds, voidIds, db }: PruneParams) => {
  const stored: { id: string; zohoInvoiceId: string; invoiceNumber: string }[] =
    await db
      .select({
        id: zohoInvoices.id,
        zohoInvoiceId: zohoInvoices.zohoInvoiceId,
        invoiceNumber: zohoInvoices.invoiceNumber,
      })
      .from(zohoInvoices);

  const gone = stored.filter(
    (row) => voidIds.has(row.zohoInvoiceId) || !seenIds.has(row.zohoInvoiceId),
  );

  if (gone.length === 0) return { removed: 0, skipped: false, invoices: [] };

  if (gone.length > MAX_PRUNE) {
    return {
      removed: 0,
      skipped: true,
      invoices: gone.map((row) => row.invoiceNumber),
    };
  }

  await db.delete(zohoInvoices).where(
    inArray(
      zohoInvoices.id,
      gone.map((row) => row.id),
    ),
  );

  return {
    removed: gone.length,
    skipped: false,
    invoices: gone.map((row) => row.invoiceNumber),
  };
};

export default pruneZohoInvoices;
