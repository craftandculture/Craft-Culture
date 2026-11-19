import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrders, zohoSalesOrders } from '@/database/schema';

import type { WarehouseUpdateOrder } from '../types';

/**
 * How an order is named in a warehouse update to its distributor
 *
 * A Zoho order by its SO number, with its invoice number and reference. A
 * private client order by its PCO number, with the client, whom the
 * distributor already knows.
 *
 * @param orderId - A Zoho sales order or private client order id
 * @param fallback - The order number held on the pick list or batch
 */
const describeUpdateOrder = async (orderId: string, fallback: string): Promise<WarehouseUpdateOrder> => {
  const [zoho] = await db
    .select({ so: zohoSalesOrders.salesOrderNumber, inv: zohoSalesOrders.invoiceNumber, ref: zohoSalesOrders.referenceNumber })
    .from(zohoSalesOrders)
    .where(eq(zohoSalesOrders.id, orderId))
    .limit(1);

  if (zoho) {
    const reference = [zoho.inv, zoho.ref].filter(Boolean).join(' · ');
    return { orderId, label: zoho.so || fallback, reference: reference || null, client: null };
  }

  const [pco] = await db
    .select({ number: privateClientOrders.orderNumber, client: privateClientOrders.clientName })
    .from(privateClientOrders)
    .where(eq(privateClientOrders.id, orderId))
    .limit(1);

  return { orderId, label: pco?.number ?? fallback, reference: null, client: pco?.client?.trim() || null };
};

export default describeUpdateOrder;
