'use server';

import { and, eq, lt, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import isStaff from '@/app/_distribution/utils/isStaff';
import getStockWines from '@/app/_winelabs/data/getStockWines';
import priceWineInBond from '@/app/_winelabs/data/priceWineInBond';
import isInternalLwin from '@/app/_winelabs/utils/isInternalLwin';
import db from '@/database/client';
import { winelabsMarket } from '@/database/schema';

/** A London price older than this is asked for again */
const REFRESH_DAYS = 30;
/** A wine the exchanges did not list is asked again after this: mostly small growers they never carry */
const UNLISTED_REFRESH_DAYS = 90;
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
 * Largest holdings first, one wine and bottle size at a time (a magnum has
 * its own price, not twice a bottle's), stopping at the first error so a
 * reached cap costs nothing more. A listed wine is asked again after 30 days,
 * an unlisted one after 90; our internal codes are never asked. The order book
 * costs 15 credits; the trades another 15, only when they are 90 days old.
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
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const stuck = new Date(Date.now() - STUCK_MINUTES * 60 * 1000);
  // Due: never asked, priced over 30 days ago, unlisted over 90, or claimed by a run that died
  const due = or(
    and(eq(winelabsMarket.status, 'priced'), lt(winelabsMarket.checkedAt, daysAgo(REFRESH_DAYS))),
    and(eq(winelabsMarket.status, 'unlisted'), lt(winelabsMarket.checkedAt, daysAgo(UNLISTED_REFRESH_DAYS))),
    and(eq(winelabsMarket.status, 'checking'), lt(winelabsMarket.checkedAt, stuck)),
  )!;

  const [wines, held] = await Promise.all([
    getStockWines(),
    db.select({ row: winelabsMarket, due: sql<boolean>`(${due})` }).from(winelabsMarket),
  ]);
  const keyOf = (row: { lwin11: string; format: string }) => `${row.lwin11}:${row.format}`;
  const before = new Map(held.map(({ row, due: isDue }) => [keyOf(row), { ...row, due: isDue }]));
  // Each size held is asked for apart, largest holdings first
  const todo = wines
    .filter((wine) => !isInternalLwin(wine.lwin7))
    .flatMap(({ formats, ...wine }) =>
      Object.entries(formats).map(([format, bottles]) => ({ ...wine, format, bottles })),
    )
    .sort((a, b) => b.bottles - a.bottles)
    .filter((wine) => before.get(keyOf(wine))?.due !== false);

  let priced = 0;
  let unlisted = 0;
  let error: string | null = null;
  for (const wine of todo) {
    if (priced + unlisted >= size) break;

    // Claim the wine first, so a second run started alongside this one skips it rather than paying twice
    const [claimed] = await db
      .insert(winelabsMarket)
      .values({ lwin11: wine.lwin11, lwin7: wine.lwin7, vintage: wine.vintage, format: wine.format, status: 'checking' })
      .onConflictDoUpdate({
        target: [winelabsMarket.lwin11, winelabsMarket.format],
        set: { status: 'checking', checkedAt: new Date() },
        setWhere: due,
      })
      .returning({ lwin11: winelabsMarket.lwin11 });
    if (!claimed) continue;

    const thisRow = and(eq(winelabsMarket.lwin11, wine.lwin11), eq(winelabsMarket.format, wine.format));
    try {
      const earlier = before.get(keyOf(wine));
      const saved = await priceWineInBond(wine, earlier?.status === 'checking' ? undefined : earlier);
      if (saved.status === 'priced') priced += 1;
      else unlisted += 1;
    } catch (caught) {
      // Due again next run: a wine never priced is forgotten, an earlier price is kept
      const earlier = before.get(keyOf(wine))?.status;
      if (earlier && earlier !== 'checking') {
        await db
          .update(winelabsMarket)
          .set({ status: earlier, checkedAt: new Date(0) })
          .where(thisRow);
      } else {
        await db.delete(winelabsMarket).where(thisRow);
      }
      const size = wine.format === '750' ? '' : ` (${Number(wine.format) / 10}cl)`;
      error = `${wine.name} ${wine.vintage}${size}: ${caught instanceof Error ? caught.message : String(caught)}`;
      console.error('Wine Labs in-bond check failed', { lwin11: wine.lwin11, format: wine.format, caught });
      break;
    }
  }

  revalidatePath('/platform/admin/wine-labs');
  return { priced, unlisted, remaining: todo.length - priced - unlisted, error };
};

export default runInBondBatch;
