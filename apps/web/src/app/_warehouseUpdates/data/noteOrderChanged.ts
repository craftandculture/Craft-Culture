import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { zohoSalesOrders } from '@/database/schema';
import logger from '@/utils/logger';

import describeUpdateOrder from './describeUpdateOrder';
import findOrderDistributor from './findOrderDistributor';
import getWarehouseUpdatePartners from './getWarehouseUpdatePartners';
import recordWarehouseUpdate from './recordWarehouseUpdate';

/**
 * Record that a Zoho order's lines changed after picking started, for a
 * problem alert to its distributor
 *
 * Only while the order is being picked or is picked: once dispatched, a
 * change is an invoicing matter, not a warehouse one. Once per Zoho edit.
 * Only for distributors switched on. Never throws.
 *
 * @param orderId - The Zoho sales order
 * @param zohoModifiedAt - When Zoho says it was edited
 */
const noteOrderChanged = async (orderId: string, zohoModifiedAt: Date) => {
  try {
    const [order] = await db
      .select({ status: zohoSalesOrders.status, number: zohoSalesOrders.salesOrderNumber })
      .from(zohoSalesOrders)
      .where(eq(zohoSalesOrders.id, orderId))
      .limit(1);
    if (!order || (order.status !== 'picking' && order.status !== 'picked')) return;

    const partnerId = await findOrderDistributor(orderId);
    if (!partnerId) return;
    if (!(await getWarehouseUpdatePartners()).has(partnerId)) return;

    await recordWarehouseUpdate({
      dedupeKey: `changed:${orderId}:${zohoModifiedAt.toISOString()}`,
      partnerId,
      kind: 'problem',
      orderId,
      data: { orders: [await describeUpdateOrder(orderId, order.number)], problem: 'changed' },
      sendAt: new Date(),
      status: 'pending',
    });
  } catch (error) {
    logger.error('Warehouse updates: could not record an order change', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export default noteOrderChanged;
