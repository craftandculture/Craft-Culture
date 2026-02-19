import { and, eq, sql } from 'drizzle-orm';

import { wmsStock, wmsStockReservations } from '@/database/schema';

interface ReleaseParams {
  orderId: string;
  orderType: 'zoho' | 'pco';
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

  for (const reservation of activeReservations) {
    // Restore stock availability
    await db
      .update(wmsStock)
      .set({
        reservedCases: sql`${wmsStock.reservedCases} - ${reservation.quantityCases}`,
        availableCases: sql`${wmsStock.availableCases} + ${reservation.quantityCases}`,
        updatedAt: now,
      })
      .where(eq(wmsStock.id, reservation.stockId));

    // Mark reservation as released
    await db
      .update(wmsStockReservations)
      .set({
        status: 'released' as const,
        releasedAt: now,
        releaseReason: reason,
        updatedAt: now,
      })
      .where(eq(wmsStockReservations.id, reservation.id));

    totalCasesReleased += reservation.quantityCases;
  }

  return {
    releasedCount: activeReservations.length,
    totalCasesReleased,
  };
};

export default releaseStockReservations;
