import db from '@/database/client';
import { type DistributorWarehouseUpdate, distributorWarehouseUpdates } from '@/database/schema';

import type { WarehouseUpdateData } from '../types';

/**
 * Write one warehouse update, once: a second call with the same key (a
 * repeated tap, a resent post) changes nothing
 *
 * @param update - The row to write
 * @returns Whether it was new
 */
const recordWarehouseUpdate = async (update: {
  dedupeKey: string;
  partnerId: string;
  kind: DistributorWarehouseUpdate['kind'];
  orderId?: string | null;
  batchId?: string | null;
  data: WarehouseUpdateData;
  sendAt: Date;
  status: 'info' | 'pending';
}) => {
  const inserted = await db
    .insert(distributorWarehouseUpdates)
    .values({ ...update, data: update.data as unknown as Record<string, unknown> })
    .onConflictDoNothing({ target: distributorWarehouseUpdates.dedupeKey })
    .returning({ id: distributorWarehouseUpdates.id });
  return inserted.length > 0;
};

export default recordWarehouseUpdate;
