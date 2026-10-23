import { desc, isNotNull } from 'drizzle-orm';

import getStockWines from '@/app/_winelabs/data/getStockWines';
import db from '@/database/client';
import { winelabsCalls, winelabsWines } from '@/database/schema';
import getWinelabsCreditsThisMonth from '@/lib/winelabs/getWinelabsCreditsThisMonth';
import isWinelabsConfigured from '@/lib/winelabs/isWinelabsConfigured';
import serverConfig from '@/server.config';

/**
 * Where the Wine Labs check stands: spend, counts and the wines to look at
 *
 * Only wines still in stock are counted, so a sold-out wine checked earlier
 * drops out of the figures without being deleted from the cache.
 *
 * @returns Configuration, credits, counts and the exceptions list
 */
const getCoverageSummary = async () => {
  const [wines, rows, credits, [lastError]] = await Promise.all([
    getStockWines(),
    db.select().from(winelabsWines),
    getWinelabsCreditsThisMonth(),
    db
      .select({ at: winelabsCalls.createdAt, endpoint: winelabsCalls.endpoint, error: winelabsCalls.error })
      .from(winelabsCalls)
      .where(isNotNull(winelabsCalls.error))
      .orderBy(desc(winelabsCalls.createdAt))
      .limit(1),
  ]);

  const byLwin11 = new Map(rows.map((row) => [row.lwin11, row]));
  const checked = wines.flatMap((wine) => {
    const row = byLwin11.get(wine.lwin11);
    return row ? [{ ...row, bottles: wine.bottles, vintage: wine.vintage }] : [];
  });

  const count = (status: string) => checked.filter((row) => row.matchStatus === status).length;

  return {
    configured: isWinelabsConfigured(),
    credits,
    cap: serverConfig.winelabsMonthlyCreditCap,
    lastError: lastError ?? null,
    inStock: wines.length,
    checked: checked.length,
    agrees: count('agrees'),
    different: count('different'),
    notFound: count('not_found'),
    internalKnown: count('internal_known'),
    hasPrice: checked.filter((row) => row.priceMedianUsd !== null).length,
    hasWindow: checked.filter((row) => row.drinkFrom !== null).length,
    exceptions: checked.filter((row) => row.matchStatus !== 'agrees'),
    sample: checked.filter((row) => row.matchStatus === 'agrees').slice(0, 25),
  };
};

export type CoverageSummary = Awaited<ReturnType<typeof getCoverageSummary>>;

export default getCoverageSummary;
