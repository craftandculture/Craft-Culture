import { and, eq } from 'drizzle-orm';

import { wmsStockReservations } from '@/database/schema';

import giveBackHeldCases from './giveBackHeldCases';

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
      // The size as claimed, not as first read: a pick that consumed part of
      // the hold in between leaves it active but smaller, and giving back the
      // earlier figure offered a picked case for sale.
      .returning({
        id: wmsStockReservations.id,
        quantityCases: wmsStockReservations.quantityCases,
      });

    const [held] = claimed;
    if (!held) continue;

    // Restore stock availability
    await giveBackHeldCases({ db, stockId: reservation.stockId, cases: held.quantityCases, now });

    releasedCount++;
    totalCasesReleased += held.quantityCases;
  }

  return {
    releasedCount,
    totalCasesReleased,
  };
};

export default releaseStockReservations;
