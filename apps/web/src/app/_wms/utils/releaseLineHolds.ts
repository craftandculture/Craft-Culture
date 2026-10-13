import { and, eq, inArray, sql } from 'drizzle-orm';

import { wmsStock, wmsStockReservations } from '@/database/schema';

/**
 * Release the holds on particular order lines, giving the cases back
 *
 * For a line that changed or was removed while the rest of its order keeps
 * its holds. releaseStockReservations does the same for a whole order.
 *
 * @example
 *   await releaseLineHolds({ db, orderItemIds: [lineId], reason: 'Line changed in the draft' });
 *
 * @param params.orderItemIds - The lines whose active holds go
 * @param params.reason - Recorded on each released hold
 * @returns How many cases came back
 */
const releaseLineHolds = async ({
  db,
  orderItemIds,
  reason,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  orderItemIds: string[];
  reason: string;
}) => {
  if (!orderItemIds.length) return { casesReleased: 0 };

  const holds: { id: string; stockId: string; quantityCases: number }[] = await db
    .select({
      id: wmsStockReservations.id,
      stockId: wmsStockReservations.stockId,
      quantityCases: wmsStockReservations.quantityCases,
    })
    .from(wmsStockReservations)
    .where(and(inArray(wmsStockReservations.orderItemId, orderItemIds), eq(wmsStockReservations.status, 'active')));

  const now = new Date();
  let casesReleased = 0;

  for (const hold of holds) {
    await db
      .update(wmsStock)
      .set({
        reservedCases: sql`${wmsStock.reservedCases} - ${hold.quantityCases}`,
        availableCases: sql`${wmsStock.availableCases} + ${hold.quantityCases}`,
        updatedAt: now,
      })
      .where(eq(wmsStock.id, hold.stockId));
    await db
      .update(wmsStockReservations)
      .set({ status: 'released' as const, releasedAt: now, releaseReason: reason, updatedAt: now })
      .where(eq(wmsStockReservations.id, hold.id));
    casesReleased += hold.quantityCases;
  }

  return { casesReleased };
};

export default releaseLineHolds;
