import { and, eq, inArray, isNull, ne, notInArray, or, sql } from 'drizzle-orm';

import getCommittedBottles from '@/app/_consignment/data/getCommittedBottles';
import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  privateClientOrders,
} from '@/database/schema';

/** Release requests that still have a claim on the bottles they name */
const OPEN_RELEASE_STATUSES = [
  'submitted',
  'under_review',
  'revision_requested',
  'confirmed',
] as const;

/**
 * Order statuses after which the wine has left, or will not
 *
 * A confirmed delivery keeps its claim until its order is out of the building
 * or cancelled. Counting it a little longer than strictly needed only makes
 * the member's free figure cautious, never generous.
 */
const DONE_ORDER_STATUSES = [
  'with_distributor',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;

/**
 * Bottles of each parcel already promised elsewhere
 *
 * The one answer to "how much of this can the member still commit". Offering
 * for sale and requesting a delivery each move nothing in stock, so each used
 * to see the other's bottles as free: a member could ask for delivery of wine
 * they had listed, or list wine already on its way to them.
 *
 * @example
 *   const claimed = await getClaimedBottles([stockId], { exceptRequestId });
 *   const free = held - (claimed.get(stockId) ?? 0);
 *
 * @param stockIds - The parcels being considered
 * @param options - A request or mandate to leave out, when re-checking itself
 * @returns Bottles claimed by open offers and open deliveries, keyed by stock id
 */
const getClaimedBottles = async (
  stockIds: string[],
  options: { exceptRequestId?: string; exceptMandateId?: string } = {},
) => {
  const claimed = new Map<string, number>();

  if (stockIds.length === 0) return claimed;

  const [mandates, releases] = await Promise.all([
    getCommittedBottles(stockIds, options.exceptMandateId),
    db
      .select({
        stockId: cellarReleaseRequestItems.stockId,
        bottles: sql<number>`sum(${cellarReleaseRequestItems.bottles})::int`,
      })
      .from(cellarReleaseRequestItems)
      .innerJoin(
        cellarReleaseRequests,
        eq(cellarReleaseRequestItems.requestId, cellarReleaseRequests.id),
      )
      .leftJoin(
        privateClientOrders,
        eq(cellarReleaseRequests.privateClientOrderId, privateClientOrders.id),
      )
      .where(
        and(
          inArray(cellarReleaseRequestItems.stockId, stockIds),
          inArray(cellarReleaseRequests.status, [...OPEN_RELEASE_STATUSES]),
          or(
            isNull(privateClientOrders.id),
            notInArray(privateClientOrders.status, [...DONE_ORDER_STATUSES]),
          ),
          options.exceptRequestId
            ? ne(cellarReleaseRequests.id, options.exceptRequestId)
            : undefined,
        ),
      )
      .groupBy(cellarReleaseRequestItems.stockId),
  ]);

  for (const [stockId, bottles] of mandates) {
    claimed.set(stockId, (claimed.get(stockId) ?? 0) + bottles);
  }

  for (const row of releases) {
    if (!row.stockId) continue;

    claimed.set(
      row.stockId,
      (claimed.get(row.stockId) ?? 0) + (Number(row.bottles) || 0),
    );
  }

  return claimed;
};

export default getClaimedBottles;
