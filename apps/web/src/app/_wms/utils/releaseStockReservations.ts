import { and, eq, sql } from 'drizzle-orm';

import { wmsStock, wmsStockReservations } from '@/database/schema';

interface ReleaseParams {
  orderId: string;
  orderType: 'zoho' | 'pco' | 'zoho_draft';
  reason: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

/**
 * Release all active stock reservations for an order
 *
 * Restores availableCases on wmsStock and marks reservations as released.
 * Called when an order is cancelled or voided.
 *
 * @example
 *   await releaseStockReservations({
 *     orderId: 'uuid',
 *     orderType: 'pco',
 *     reason: 'Order cancelled',
 *     db,
 *   });
 */
const releaseStockReservations = async ({
  orderId,
  orderType,
  reason,
  db,
}: ReleaseParams) => {
  // Find all active reservations for this order
  const activeReservations = await db
    .select({
      id: wmsStockReservations.id,
      stockId: wmsStockReservations.stockId,
      quantityCases: wmsStockReservations.quantityCases,
    })
    .from(wmsStockReservations)
    .where(
      and(
        eq(wmsStockReservations.orderId, orderId),
        eq(wmsStockReservations.orderType, orderType),
        eq(wmsStockReservations.status, 'active'),
      ),
    );

  if (activeReservations.length === 0) {
    return { releasedCount: 0, totalCasesReleased: 0 };
  }

  let totalCasesReleased = 0;
  const now = new Date();

  let releasedCount = 0;

  for (const reservation of activeReservations) {
    /*
      Claim the reservation before giving its cases back. Two releases of the
      same order (a cancel racing a pick-list delete, a double tap) both read
      it as active and both added its cases back to available.
    */
    const claimed = await db
      .update(wmsStockReservations)
      .set({
        status: 'released' as const,
        releasedAt: now,
        releaseReason: reason,
        updatedAt: now,
      })
      .where(
        and(
          eq(wmsStockReservations.id, reservation.id),
          eq(wmsStockReservations.status, 'active'),
        ),
      )
      .returning({ id: wmsStockReservations.id });

    if (claimed.length === 0) continue;

    // Restore stock availability
    await db
      .update(wmsStock)
      .set({
        reservedCases: sql`GREATEST(${wmsStock.reservedCases} - ${reservation.quantityCases}, 0)`,
        availableCases: sql`${wmsStock.availableCases} + ${reservation.quantityCases}`,
        updatedAt: now,
      })
      .where(eq(wmsStock.id, reservation.stockId));

    releasedCount++;
    totalCasesReleased += reservation.quantityCases;
  }

  return {
    releasedCount,
    totalCasesReleased,
  };
};

export default releaseStockReservations;
