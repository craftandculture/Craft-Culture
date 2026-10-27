'use server';

import { and, eq, lt, ne, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import isStaff from '@/app/_distribution/utils/isStaff';
import getStockWines from '@/app/_winelabs/data/getStockWines';
import db from '@/database/client';
import { winelabsMarket } from '@/database/schema';
import getInBondMarket from '@/lib/winelabs/getInBondMarket';

/** A London price older than this is asked for again */
const REFRESH_DAYS = 30;
/** A claim a run never finished (a timeout) is released after this */
const STUCK_MINUTES = 10;

export interface InBondBatchResult {
  priced: number;
  unlisted: number;
  remaining: number;
  error: string | null;
}

/**
 * Fetch the London in-bond market for the next batch of wines we hold
 *
 * Largest holdings first, skipping wines priced in the last 30 days, one wine
 * at a time, stopping at the first error so a reached cap costs nothing more.
 * A wine the exchanges do not list costs 15 credits, a listed one 30.
 *
 * @param _previous - The last result, unused (useActionState)
 * @param formData - `size`: wines to price, 1 to 50
 * @returns How many were priced or unlisted, how many remain, and any error
 */
const runInBondBatch = async (
  _previous: InBondBatchResult | null,
  formData: FormData,
): Promise<InBondBatchResult> => {
  const user = await getCurrentUser();
  if (!isStaff(user)) {
    return { priced: 0, unlisted: 0, remaining: 0, error: 'C&C staff only.' };
  }

  const size = Math.min(50, Math.max(1, Math.round(Number(formData.get('size')) || 1)));
  const fresh = new Date(Date.now() - REFRESH_DAYS * 24 * 60 * 60 * 1000);
  const stuck = new Date(Date.now() - STUCK_MINUTES * 60 * 1000);
  // Due: never asked, asked over 30 days ago, or claimed by a run that died
  const due = or(
    and(ne(winelabsMarket.status, 'checking'), lt(winelabsMarket.checkedAt, fresh)),
    and(eq(winelabsMarket.status, 'checking'), lt(winelabsMarket.checkedAt, stuck)),
  )!;

  const [wines, held] = await Promise.all([
    getStockWines(),
    db.select({ lwin11: winelabsMarket.lwin11, status: winelabsMarket.status, due: sql<boolean>`(${due})` }).from(winelabsMarket),
  ]);
  const before = new Map(held.map((row) => [row.lwin11, row]));
  const todo = wines.filter((wine) => before.get(wine.lwin11)?.due !== false);

  let priced = 0;
  let unlisted = 0;
  let error: string | null = null;
  for (const wine of todo) {
    if (priced + unlisted >= size) break;

    // Claim the wine first, so a second run started alongside this one skips it rather than paying twice
    const [claimed] = await db
      .insert(winelabsMarket)
      .values({ lwin11: wine.lwin11, lwin7: wine.lwin7, vintage: wine.vintage, status: 'checking' })
      .onConflictDoUpdate({
        target: winelabsMarket.lwin11,
        set: { status: 'checking', checkedAt: new Date() },
        setWhere: due,
      })
      .returning({ lwin11: winelabsMarket.lwin11 });
    if (!claimed) continue;

    try {
      const market = await getInBondMarket(wine.lwin7, wine.vintage);
      const listed = market.bidUsd !== null || market.askUsd !== null || market.lastUsd !== null;
      await db
        .update(winelabsMarket)
        .set({
          status: listed ? 'priced' : 'unlisted',
          bidUsd: market.bidUsd,
          askUsd: market.askUsd,
          lastUsd: market.lastUsd,
          lastTradedAt: market.lastTradedAt,
          bids: market.bids,
          asks: market.asks,
          trades: market.trades,
          venues: market.venues,
          checkedAt: new Date(),
        })
        .where(eq(winelabsMarket.lwin11, wine.lwin11));
      if (listed) priced += 1;
      else unlisted += 1;
    } catch (caught) {
      // Due again next run: a wine never priced is forgotten, an earlier price is kept
      const earlier = before.get(wine.lwin11)?.status;
      if (earlier && earlier !== 'checking') {
        await db
          .update(winelabsMarket)
          .set({ status: earlier, checkedAt: new Date(0) })
          .where(eq(winelabsMarket.lwin11, wine.lwin11));
      } else {
        await db.delete(winelabsMarket).where(eq(winelabsMarket.lwin11, wine.lwin11));
      }
      error = `${wine.name} ${wine.vintage}: ${caught instanceof Error ? caught.message : String(caught)}`;
      console.error('Wine Labs in-bond check failed', { lwin11: wine.lwin11, caught });
      break;
    }
  }

  revalidatePath('/platform/admin/wine-labs');
  return { priced, unlisted, remaining: todo.length - priced - unlisted, error };
};

export default runInBondBatch;
