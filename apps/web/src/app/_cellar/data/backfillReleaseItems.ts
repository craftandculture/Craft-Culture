import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { wmsStock } from '@/database/schema';

interface RepairableItem {
  stockId: string | null;
  lwin18?: string;
  productName?: string;
  vintage?: number | null;
  bottleSize?: string | null;
  caseConfig?: number | null;
  lotNumber?: string | null;
}

/**
 * Restore the identity of release lines that lost it
 *
 * Merging a second request into an open one re-inserted its lines from a map
 * built before the merge, so they were written with an empty LWIN and no
 * vintage, format or lot. The write is fixed; these rows are already saved.
 *
 * Every line still points at the stock it was taken from, so the missing
 * fields can be resolved on read. Without it a member's request stays
 * unidentifiable on screen and unpriceable underneath, because cost is looked
 * up by LWIN and an empty one matches nothing.
 *
 * Mutates in place and fills only what is absent, so a line that is intact —
 * or a genuinely non-vintage wine — is left exactly as it is.
 *
 * @example
 *   await backfillReleaseItems(items);
 *
 * @param items - Release lines, repaired in place
 * @returns Open bottles per stock id, which the caller needs anyway for repack
 */
const backfillReleaseItems = async (items: RepairableItem[]) => {
  const stockIds = items
    .map((item) => item.stockId)
    .filter(Boolean) as string[];

  if (stockIds.length === 0) return new Map<string, number>();

  const rows = await db
    .select({
      id: wmsStock.id,
      lwin18: wmsStock.lwin18,
      productName: wmsStock.productName,
      vintage: wmsStock.vintage,
      bottleSize: wmsStock.bottleSize,
      caseConfig: wmsStock.caseConfig,
      lotNumber: wmsStock.lotNumber,
      openBottles: wmsStock.openBottles,
    })
    .from(wmsStock)
    .where(inArray(wmsStock.id, stockIds));

  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const item of items) {
    const stock = item.stockId ? byId.get(item.stockId) : undefined;

    if (!stock) continue;

    if (!item.lwin18) item.lwin18 = stock.lwin18;
    if (!item.productName) item.productName = stock.productName;
    if (item.vintage == null) item.vintage = stock.vintage;
    if (item.bottleSize == null) item.bottleSize = stock.bottleSize;
    if (item.caseConfig == null) item.caseConfig = stock.caseConfig;
    if (item.lotNumber == null) item.lotNumber = stock.lotNumber;
  }

  return new Map(rows.map((row) => [row.id, row.openBottles ?? 0]));
};

export default backfillReleaseItems;
