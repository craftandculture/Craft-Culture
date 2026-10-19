import { TRPCError } from '@trpc/server';

import { getInvoice, listInvoices } from '@/lib/zoho/invoices';
import { getSalesOrder, listSalesOrders } from '@/lib/zoho/salesOrders';
import type { ZohoInvoice, ZohoSalesOrder } from '@/lib/zoho/types';

const findSalesOrder = async (number: string) => {
  const [so] = (await listSalesOrders({ salesorderNumber: number })).salesOrders ?? [];
  return so && so.salesorder_number.toUpperCase() === number ? getSalesOrder(so.salesorder_id) : null;
};

/**
 * A sales order and every invoice raised against it, live from Zoho
 *
 * Read live rather than from our synced copy, because the documents worth
 * checking are the ones still being prepared. The invoices come from the
 * order's own list of them, which is Zoho's link between the two; matching on
 * an invoice's reference fails as soon as that reference says something else,
 * which is exactly the fault this check looks for. Void invoices are left out.
 *
 * Either number may be given. An invoice leads back to its order through the
 * order number Zoho writes into it when one is converted into the other.
 *
 * @example
 *   const { salesOrder, invoices } = await fetchOrderDocuments('INV-000422');
 *
 * @param number - "SO-00198" or "INV-000422"
 * @returns The sales order (null if an invoice has none) and its invoices
 */
const fetchOrderDocuments = async (
  number: string,
): Promise<{ salesOrder: ZohoSalesOrder | null; invoices: ZohoInvoice[] }> => {
  const ref = number.trim().toUpperCase();

  let salesOrder = await findSalesOrder(ref);

  if (!salesOrder) {
    const [inv] = (await listInvoices({ invoiceNumber: ref })).invoices ?? [];
    if (!inv || inv.invoice_number.toUpperCase() !== ref) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `No sales order or invoice numbered ${number} in Zoho` });
    }
    const invoice = await getInvoice(inv.invoice_id);
    const soNumber = /\bSO-\d+\b/i.exec(invoice.reference_number ?? '')?.[0]?.toUpperCase();
    salesOrder = soNumber ? await findSalesOrder(soNumber) : null;
    if (!salesOrder) return { salesOrder: null, invoices: [invoice] };
  }

  const linked = (salesOrder.invoices ?? []).filter((i) => i.status !== 'void');
  const invoices = await Promise.all(linked.map((i) => getInvoice(i.invoice_id)));

  return { salesOrder, invoices: invoices.filter((i) => i.status !== 'void') };
};

export default fetchOrderDocuments;
