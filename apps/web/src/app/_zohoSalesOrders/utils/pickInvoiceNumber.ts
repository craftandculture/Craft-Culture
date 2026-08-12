import type { ZohoSalesOrder } from '@/lib/zoho/types';

/** Invoice states that shouldn't be shown against an order. */
const IGNORED_STATUSES = new Set(['void', 'draft']);

/**
 * Resolve the invoice number for a Zoho sales order from the order itself.
 *
 * Zoho's Get Sales Order response carries the invoices raised against the
 * order, which is the authoritative link. The fallback used elsewhere — match
 * `zoho_invoices.reference_number` to the SO number — silently fails whenever
 * the invoice's reference carries something else (a consignment label, a PCO
 * number), leaving the WMS pick screens with no invoice number to show.
 *
 * Void and draft invoices are ignored; when an order has several, the most
 * recent wins.
 *
 * @example
 *   pickInvoiceNumber(fullOrder); // 'INV-000293'
 *
 * @param order - A sales order from the Zoho detail endpoint
 * @returns The invoice number, or null when the order carries none
 */
const pickInvoiceNumber = (order: Pick<ZohoSalesOrder, 'invoices'>) => {
  const invoices = (order.invoices ?? []).filter(
    (invoice) =>
      !!invoice.invoice_number &&
      !IGNORED_STATUSES.has((invoice.status ?? '').toLowerCase()),
  );

  if (invoices.length === 0) return null;

  const [latest] = [...invoices].sort((a, b) =>
    (b.date ?? '').localeCompare(a.date ?? ''),
  );

  return latest?.invoice_number ?? null;
};

export default pickInvoiceNumber;
