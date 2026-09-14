import { and, eq, inArray, ne, sql } from 'drizzle-orm';

import db from '@/database/client';
import { saleMandateLots, saleMandates } from '@/database/schema';

import { COMMITTING_STATUSES } from '../utils/mandateStatuses';

/**
 * How many bottles of each parcel are already promised to an open mandate
 *
 * Offering wine does not move it or reserve it — `availableCases` on the stock
 * row is exactly what it was before — so a parcel already under offer looks
 * completely free to the next offer that comes along. Without this, a member
 * can offer the same six bottles twice at two different prices, we can accept
 * both, and twelve bottles go onto the price list against six in the building.
 *
 * The window between this read and the write that follows it is small but real.
 * Closing it properly means locking the stock rows for the length of a review
 * that takes days, which is worse; the listing step re-checks, so a race here
 * surfaces at the point where it can still be refused.
 *
 * @example
 *   const committed = await getCommittedBottles([stockId]);
 *   const free = available - (committed.get(stockId) ?? 0);
 *
 * @param stockIds - The parcels being considered
 * @param exceptMandateId - Ignore this mandate's own claim, when re-checking it
 * @returns Bottles already committed, keyed by stock id
 */
const getCommittedBottles = async (
  stockIds: string[],
  exceptMandateId?: string,
) => {
  if (stockIds.length === 0) return new Map<string, number>();

  const rows = await db
    .select({
      stockId: saleMandateLots.stockId,
      bottles: sql<number>`sum(${saleMandateLots.bottlesRemaining})`,
    })
    .from(saleMandateLots)
    .innerJoin(saleMandates, eq(saleMandateLots.mandateId, saleMandates.id))
    .where(
      and(
        inArray(saleMandateLots.stockId, stockIds),
        inArray(saleMandates.status, [...COMMITTING_STATUSES]),
        exceptMandateId ? ne(saleMandates.id, exceptMandateId) : undefined,
      ),
    )
    .groupBy(saleMandateLots.stockId);

  return new Map(rows.map((row) => [row.stockId, Number(row.bottles) || 0]));
};

export default getCommittedBottles;
