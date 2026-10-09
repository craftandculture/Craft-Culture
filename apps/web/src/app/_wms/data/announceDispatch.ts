import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users, wmsDispatchBatchOrders, wmsDispatchBatches } from '@/database/schema';
import logger from '@/utils/logger';

import describeOrder from './describeOrder';
import postWarehouseSlack from '../utils/postWarehouseSlack';

/**
 * Tell #warehouse-activity a dispatch has gone out (or been delivered): the
 * batch, who it is for, the cases and each order on it
 *
 * Never throws: the dispatch stands whether or not Slack hears about it.
 *
 * @param batchId - The dispatch batch
 * @param event - 'dispatched' or 'delivered'
 */
const announceDispatch = async (batchId: string, event: 'dispatched' | 'delivered' = 'dispatched') => {
  try {
    const [batch] = await db.select().from(wmsDispatchBatches).where(eq(wmsDispatchBatches.id, batchId));
    if (!batch) return;

    const orders = await db
      .select({ orderId: wmsDispatchBatchOrders.orderId, orderNumber: wmsDispatchBatchOrders.orderNumber })
      .from(wmsDispatchBatchOrders)
      .where(eq(wmsDispatchBatchOrders.batchId, batchId));

    const [by] = batch.dispatchedBy
      ? await db.select({ name: users.name }).from(users).where(eq(users.id, batch.dispatchedBy))
      : [];

    const described = await Promise.all(orders.slice(0, 15).map((o) => describeOrder(o.orderId, o.orderNumber)));
    if (orders.length > 15) described.push(`…and ${orders.length - 15} more orders`);

    const head =
      event === 'delivered'
        ? `:package: *Delivered* ${batch.batchNumber} to ${batch.distributorName}`
        : `:truck: *Dispatched* ${batch.batchNumber} to ${batch.distributorName}`;
    const meta = [
      `${orders.length} order${orders.length === 1 ? '' : 's'}`,
      batch.totalCases ? `${batch.totalCases} cases` : null,
      event === 'dispatched' && by ? `by ${by.name}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    await postWarehouseSlack([head, meta, described.map((d) => `• ${d}`).join('\n')].filter(Boolean).join('\n'));
  } catch (error) {
    // Best effort only: never fail the warehouse action, but leave a trace
    logger.error('Warehouse activity: could not build the post', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export default announceDispatch;
