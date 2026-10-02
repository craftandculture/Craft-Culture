import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { zohoInvoices } from '@/database/schema';

import type { ExportDocument } from '../schemas/exportDocumentSchema';

/**
 * Which of a document's invoices have changed in Zoho since it was built
 *
 * The invoice sync drops voided invoices and refreshes totals every ten
 * minutes, so an invoice that has gone, or whose total moved, has been
 * reissued or cancelled — as INV-000368, 370 and 371 were after EXP-2026-0040
 * was first drafted.
 *
 * @param doc - The export document
 * @returns Invoice numbers that no longer match, with what changed
 */
const findStaleSources = async (doc: ExportDocument) => {
  const ids = doc.sources.map((s) => s.zohoInvoiceId);
  if (ids.length === 0) return [];
  const current = await db
    .select({ zohoInvoiceId: zohoInvoices.zohoInvoiceId, total: zohoInvoices.total })
    .from(zohoInvoices)
    .where(inArray(zohoInvoices.zohoInvoiceId, ids));
  const byId = new Map(current.map((c) => [c.zohoInvoiceId, c.total]));

  return doc.sources.flatMap((s) => {
    const total = byId.get(s.zohoInvoiceId);
    if (total === undefined) return [{ invoiceNumber: s.invoiceNumber, reason: 'voided or deleted in Zoho' }];
    if (Math.abs(total - s.totalUsd) > 0.005) {
      return [{ invoiceNumber: s.invoiceNumber, reason: `total changed from USD ${s.totalUsd.toFixed(2)} to ${total.toFixed(2)}` }];
    }
    return [];
  });
};

export default findStaleSources;
