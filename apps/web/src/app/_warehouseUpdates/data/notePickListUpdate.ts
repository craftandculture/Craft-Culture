import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsPickListItems, wmsPickLists } from '@/database/schema';
import logger from '@/utils/logger';

import describeUpdateOrder from './describeUpdateOrder';
import findOrderDistributor from './findOrderDistributor';
import getWarehouseUpdatePartners from './getWarehouseUpdatePartners';
import recordWarehouseUpdate from './recordWarehouseUpdate';
import { CANCELLED_GRACE_MINUTES } from '../constants';
import nextPickedSlot from '../utils/nextPickedSlot';
import summarisePickLines from '../utils/summarisePickLines';

/**
 * Record what just happened to a pick list for its distributor's warehouse
 * updates
 *
 * Released: kept for the end-of-day summary, never emailed on its own.
 * Completed: picked & packed, due at the next 11:00 or 16:00 Gulf, or now for
 * a distributor who wants each one straight away. Cancelled: a problem alert,
 * held back half an hour so a list withdrawn and released again says nothing.
 *
 * Only for distributors switched on. Never throws: the warehouse keeps
 * working whatever happens here. Call before a cancelled list is deleted.
 *
 * @param pickListId - The pick list
 * @param event - What just happened
 */
const notePickListUpdate = async (pickListId: string, event: 'released' | 'completed' | 'cancelled') => {
  try {
    const [pickList] = await db.select().from(wmsPickLists).where(eq(wmsPickLists.id, pickListId)).limit(1);
    if (!pickList?.orderId) return;

    const partnerId = await findOrderDistributor(pickList.orderId);
    if (!partnerId) return;
    const prefs = (await getWarehouseUpdatePartners()).get(partnerId);
    if (!prefs) return;

    const items = await db
      .select({
        name: wmsPickListItems.productName,
        cases: wmsPickListItems.quantityCases,
        bottles: wmsPickListItems.quantityBottles,
      })
      .from(wmsPickListItems)
      .where(eq(wmsPickListItems.pickListId, pickListId));

    const order = await describeUpdateOrder(pickList.orderId, pickList.orderNumber);
    const data = { orders: [order], pickListNumber: pickList.pickListNumber, ...summarisePickLines(items) };
    const now = new Date();

    if (event === 'released') {
      await recordWarehouseUpdate({
        dedupeKey: `received:${pickList.id}`,
        partnerId,
        kind: 'received',
        orderId: pickList.orderId,
        data,
        sendAt: now,
        status: 'info',
      });
    } else if (event === 'completed') {
      await recordWarehouseUpdate({
        dedupeKey: `picked:${pickList.id}`,
        partnerId,
        kind: 'picked',
        orderId: pickList.orderId,
        data,
        sendAt: prefs.picked === 'immediate' ? now : nextPickedSlot(now),
        status: 'pending',
      });
    } else {
      await recordWarehouseUpdate({
        dedupeKey: `cancelled:${pickList.id}`,
        partnerId,
        kind: 'problem',
        orderId: pickList.orderId,
        data: { ...data, problem: 'cancelled' },
        sendAt: new Date(now.getTime() + CANCELLED_GRACE_MINUTES * 60 * 1000),
        status: 'pending',
      });
    }
  } catch (error) {
    logger.error('Warehouse updates: could not record a pick list event', {
      pickListId,
      event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export default notePickListUpdate;
