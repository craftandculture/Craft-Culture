import { and, eq, inArray } from 'drizzle-orm';

import type db from '@/database/client';
import { cellarPurchaseItems, wmsStockReservations } from '@/database/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Give a purchase's parcels back to the list
 *
 * A cancelled or lapsed purchase that leaves its reservations active holds
 * stock nobody is buying: it stays off the catalogue, and
 * `transferStockOwnership` keeps refusing to move it. That is worse than the
 * order never having been placed, because nothing on any screen says why the
 * wine is unavailable.
 *
 * Only active reservations are touched, so this is safe to call twice.
 *
 * @param tx - The transaction cancelling the purchase
 * @param purchaseId - The purchase being unwound
 * @param reason - Recorded on the reservation, for the audit trail
 * @returns How many holds were released
 */
const releasePurchaseHolds = async (
  tx: Tx,
  purchaseId: string,
  reason: string,
) => {
  const items = await tx
    .select({ reservationId: cellarPurchaseItems.reservationId })
    .from(cellarPurchaseItems)
    .where(eq(cellarPurchaseItems.purchaseId, purchaseId));

  const ids = items
    .map((item) => item.reservationId)
    .filter(Boolean) as string[];

  if (ids.length === 0) return 0;

  await tx
    .update(wmsStockReservations)
    .set({
      status: 'released',
      releasedAt: new Date(),
      releaseReason: reason,
    })
    .where(
      and(
        inArray(wmsStockReservations.id, ids),
        eq(wmsStockReservations.status, 'active'),
      ),
    );

  return ids.length;
};

export default releasePurchaseHolds;
