import { desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsDeliveryNotes, wmsDispatchBatchOrders, wmsDispatchBatches } from '@/database/schema';
import logger from '@/utils/logger';

import describeUpdateOrder from './describeUpdateOrder';
import getWarehouseUpdatePartners from './getWarehouseUpdatePartners';
import recordWarehouseUpdate from './recordWarehouseUpdate';

/**
 * Record that a dispatch batch is ready to go (staged) or has gone
 * (dispatched), for its distributor's ready for dispatch email
 *
 * One email per batch, whichever comes first: a batch staged and then
 * dispatched is told once. Sent straight away. Only for distributors
 * switched on. Never throws.
 *
 * @param batchId - The dispatch batch
 * @param stage - Staged or dispatched
 */
const noteBatchReady = async (batchId: string, stage: 'staged' | 'dispatched') => {
  try {
    const [batch] = await db.select().from(wmsDispatchBatches).where(eq(wmsDispatchBatches.id, batchId)).limit(1);
    if (!batch) return;
    const prefs = (await getWarehouseUpdatePartners()).get(batch.distributorId);
    if (!prefs) return;

    const batchOrders = await db
      .select({ orderId: wmsDispatchBatchOrders.orderId, orderNumber: wmsDispatchBatchOrders.orderNumber })
      .from(wmsDispatchBatchOrders)
      .where(eq(wmsDispatchBatchOrders.batchId, batchId));
    if (batchOrders.length === 0) return;

    const [note] = await db
      .select({ number: wmsDeliveryNotes.deliveryNoteNumber, url: wmsDeliveryNotes.pdfUrl })
      .from(wmsDeliveryNotes)
      .where(eq(wmsDeliveryNotes.batchId, batchId))
      .orderBy(desc(wmsDeliveryNotes.createdAt))
      .limit(1);

    const orders = await Promise.all(batchOrders.map((o) => describeUpdateOrder(o.orderId, o.orderNumber)));

    await recordWarehouseUpdate({
      dedupeKey: `ready:${batchId}`,
      partnerId: batch.distributorId,
      kind: 'ready',
      batchId,
      data: {
        orders,
        batchNumber: batch.batchNumber,
        stage,
        cases: batch.totalCases,
        deliveryNoteNumber: note?.number ?? null,
        deliveryNoteUrl: note?.url ?? null,
      },
      sendAt: new Date(),
      status: 'pending',
    });
  } catch (error) {
    logger.error('Warehouse updates: could not record a dispatch', {
      batchId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export default noteBatchReady;
