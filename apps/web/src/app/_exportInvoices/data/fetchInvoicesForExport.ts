import { eq, inArray, or } from 'drizzle-orm';

import readInvoiceSubject from '@/app/_triangulation/utils/readInvoiceSubject';
import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import db from '@/database/client';
import { zohoInvoices, zohoSalesOrders } from '@/database/schema';
import { getInvoice, listInvoices } from '@/lib/zoho/invoices';
import type { ZohoLineItem } from '@/lib/zoho/types';

import type { ExportInvoiceInput } from '../utils/buildExportLines';
import roundMoney from '../utils/roundMoney';

/** Fields Zoho returns on a line that the shared type does not declare */
type ExportZohoLine = ZohoLineItem & { line_item_id?: string; hsn_or_sac?: string };

/**
 * Fetch an invoice, following it if Zoho deleted and re-raised it
 *
 * An invoice deleted in Zoho can linger in the synced list until the prune
 * catches it, and a re-raised invoice keeps its number under a new id. So a
 * 404 is retried by number; if the number is gone too, the stale row is
 * removed and the operator is told which invoice to untick.
 *
 * @param zohoInvoiceId - The id from the synced list
 * @returns The invoice as it stands in Zoho now
 */
const getCurrentInvoice = async (zohoInvoiceId: string) => {
  try {
    return await getInvoice(zohoInvoiceId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/404|1002|does not exist/i.test(message)) throw error;

    const [row] = await db
      .select({ invoiceNumber: zohoInvoices.invoiceNumber })
      .from(zohoInvoices)
      .where(eq(zohoInvoices.zohoInvoiceId, zohoInvoiceId))
      .limit(1);
    const number = row?.invoiceNumber ?? zohoInvoiceId;
    const { invoices: matches } = await listInvoices({ invoiceNumber: number });
    const replacement = matches.find((m) => m.invoice_number === number && m.status !== 'void');
    if (replacement) return await getInvoice(replacement.invoice_id);

    await db.delete(zohoInvoices).where(eq(zohoInvoices.zohoInvoiceId, zohoInvoiceId));
    throw new Error(`${number} no longer exists in Zoho (deleted or replaced). Untick it and choose its replacement.`, {
      cause: error,
    });
  }
};

/**
 * Read the invoices an export invoice is built from, live from Zoho
 *
 * The sync stores invoice headers only, and invoices are reissued after they
 * are first raised, so the current lines are always fetched. Header rows are
 * dropped. A discount applied to the whole invoice rather than per line is
 * shared across the lines, so the lines always add up to what the invoice
 * bills — which is the figure the export invoice must meet.
 *
 * @param zohoInvoiceIds - Zoho invoice ids, in print order
 * @returns The invoices, reduced to what the export needs
 */
const fetchInvoicesForExport = async (zohoInvoiceIds: string[]) => {
  const invoices = [];
  for (const id of zohoInvoiceIds) {
    invoices.push(await getCurrentInvoice(id));
  }

  // The invoice's reference holds its sales order; a reissued invoice is not
  // re-linked on the SO row, so that is read first and the SO link second
  const numbers = invoices.map((i) => i.invoice_number);
  const references = invoices
    .map((i) => i.reference_number?.trim().match(/^SO-\d+/i)?.[0])
    .filter((r): r is string => Boolean(r));
  const salesOrders =
    numbers.length || references.length
      ? await db
          .select({
            salesOrderNumber: zohoSalesOrders.salesOrderNumber,
            invoiceNumber: zohoSalesOrders.invoiceNumber,
            referenceNumber: zohoSalesOrders.referenceNumber,
          })
          .from(zohoSalesOrders)
          .where(
            or(
              inArray(zohoSalesOrders.invoiceNumber, numbers.length ? numbers : ['']),
              inArray(zohoSalesOrders.salesOrderNumber, references.length ? references : ['']),
            ),
          )
      : [];

  return invoices.map((inv): ExportInvoiceInput => {
    const rows = (inv.line_items as ExportZohoLine[]).filter(
      (l) => !/header/i.test(l.item_type ?? '') && (l.quantity ?? 0) > 0,
    );
    const lineSum = roundMoney(rows.reduce((s, l) => s + (l.item_total ?? l.rate * l.quantity), 0));
    const factor = lineSum > 0 && Math.abs(lineSum - inv.total) > 0.01 ? inv.total / lineSum : 1;

    let allocated = 0;
    const lines = rows.map((l, i) => {
      const gross = l.item_total ?? l.rate * l.quantity;
      const netUsd =
        i === rows.length - 1 && factor !== 1
          ? roundMoney(inv.total - allocated)
          : roundMoney(gross * factor);
      allocated += netUsd;
      const sku = l.sku?.trim() || null;
      return {
        lineItemId: l.line_item_id ?? `${inv.invoice_id}-${i + 1}`,
        name: l.name,
        description: l.description ?? '',
        lwin18: sku && /^\d{7}-?\d{4}-?\d{2}-?\d{5}$/.test(sku) ? normalizeLwin18(sku.replace(/-/g, '')) : sku,
        quantity: l.quantity,
        rate: l.rate,
        netUsd,
        zohoHsCode: l.hsn_or_sac ?? null,
      };
    });

    const reference = inv.reference_number?.trim() ?? '';
    const referencedSo = reference.match(/^SO-\d+/i)?.[0];
    const so =
      salesOrders.find((s) => referencedSo && s.salesOrderNumber === referencedSo) ??
      salesOrders.find((s) => s.invoiceNumber === inv.invoice_number);
    const subject = readInvoiceSubject(inv) ?? '';
    const pco = `${subject} ${reference} ${so?.referenceNumber ?? ''}`.match(/PCO-\d{4}-\d+/i)?.[0];

    return {
      zohoInvoiceId: inv.invoice_id,
      invoiceNumber: inv.invoice_number,
      soNumber: so?.salesOrderNumber ?? referencedSo ?? null,
      pcoNumber: pco ? pco.toUpperCase() : null,
      invoiceDate: inv.date,
      totalUsd: inv.total,
      lines,
    };
  });
};

export default fetchInvoicesForExport;
