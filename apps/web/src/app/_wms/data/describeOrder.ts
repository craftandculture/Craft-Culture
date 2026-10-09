import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrders, zohoSalesOrders } from '@/database/schema';

/**
 * How an order reads in a warehouse post: its numbers and who it is for
 *
 * Pick lists and dispatch batches hold a bare order id that may be a Zoho
 * sales order or a private client order, so both are tried.
 *
 * @param orderId - The order's id
 * @param fallback - The order number held on the pick list or batch
 * @returns e.g. "INV-000371 · SO-00412 · PCO-2026-00060 — Cru Wine"
 */
const describeOrder = async (orderId: string, fallback: string) => {
  const [zoho] = await db
    .select({
      so: zohoSalesOrders.salesOrderNumber,
      inv: zohoSalesOrders.invoiceNumber,
      ref: zohoSalesOrders.referenceNumber,
      customer: zohoSalesOrders.customerName,
    })
    .from(zohoSalesOrders)
    .where(eq(zohoSalesOrders.id, orderId));

  if (zoho) {
    const numbers = [zoho.inv, zoho.so, zoho.ref].filter(Boolean).join(' · ');
    return `${numbers || fallback} — ${zoho.customer}`;
  }

  const [pco] = await db
    .select({ number: privateClientOrders.orderNumber, client: privateClientOrders.clientName })
    .from(privateClientOrders)
    .where(eq(privateClientOrders.id, orderId));

  return pco ? `${pco.number} — ${pco.client}` : fallback;
};

export default describeOrder;
