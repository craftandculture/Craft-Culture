import { and, eq, sql } from 'drizzle-orm';

import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import { wmsProductPricing, wmsStock } from '@/database/schema';

import lotShipmentCost from '../utils/lotShipmentCost';

/**
 * What each of an owner's wines cost them, per bottle
 *
 * `importPerBottle` is the paid goods cost, by the Pricing Manager's rule: the
 * lot's own invoice line, then a typed import price, then the nearest line for
 * the wine. `landedPerBottle` adds the freight on that line, since the owner
 * paid it: C&C buys sample bottles, and reimburses damage, at this figure.
 * Rows emptied to zero are included, so wine that has already left still has
 * a cost.
 *
 * Keyed by the exact LWIN18, and also by the pack-agnostic wine key where
 * exactly one of the owner's LWIN18s holds that key. Keyed by the wine key
 * alone, two wines differing only in their pack digits (a 6-pack and a
 * repacked single bought at different prices) shared one entry, and whichever
 * row the database happened to return first set the cost for both. Look up
 * the exact code first; the wine key is a fallback for a code the owner does
 * not hold, and answers only when it cannot mean two different wines (the
 * same guard as the statement's own ask lookup).
 *
 * @example
 *   const costs = await getOwnerWineCosts(ownerId);
 *   (costs.get(lwin18) ?? costs.get(lwinPakKeyOf(lwin18)))?.landedPerBottle;
 *
 * @param ownerId - The owner
 * @returns Map of LWIN18, or unambiguous wine key → { importPerBottle, landedPerBottle }
 */
const getOwnerWineCosts = async (ownerId: string) => {
  const rows = await db
    .select({
      lwin18: wmsStock.lwin18,
      productCost: sql<number | null>`ship.product_cost`,
      landedCost: sql<number | null>`ship.landed_cost`,
      ownLine: sql<boolean | null>`ship.own_line`,
      typedImport: wmsProductPricing.importPricePerBottle,
    })
    .from(wmsStock)
    .leftJoin(lotShipmentCost, sql`true`)
    .leftJoin(wmsProductPricing, eq(wmsProductPricing.lwin18, wmsStock.lwin18))
    .where(and(eq(wmsStock.ownerId, ownerId)));

  const costs = new Map<string, { importPerBottle: number | null; landedPerBottle: number | null }>();
  for (const row of rows) {
    const key = row.lwin18;
    const product = row.productCost && row.productCost > 0 ? Number(row.productCost) : null;
    const typed = row.typedImport && row.typedImport > 0 ? row.typedImport : null;
    const importPerBottle = (row.ownLine ? product : null) ?? typed ?? product;
    const freight =
      row.landedCost != null && product != null ? Math.max(0, Number(row.landedCost) - product) : 0;
    const landedPerBottle = importPerBottle != null ? importPerBottle + freight : null;

    const current = costs.get(key);
    // Prefer a row with a cost over one without
    if (!current || (current.importPerBottle == null && importPerBottle != null)) {
      costs.set(key, {
        importPerBottle: importPerBottle != null ? Math.round(importPerBottle * 100) / 100 : null,
        landedPerBottle: landedPerBottle != null ? Math.round(landedPerBottle * 100) / 100 : null,
      });
    }
  }

  /*
    The wine-key fallback, only where one LWIN18 holds the key. The two kinds
    of key cannot collide: an LWIN18 has four segments, a wine key three.
  */
  const codesPerKey = new Map<string, string[]>();
  for (const lwin18 of costs.keys()) {
    const key = lwinPakKeyOf(lwin18);
    codesPerKey.set(key, [...(codesPerKey.get(key) ?? []), lwin18]);
  }
  for (const [key, codes] of codesPerKey) {
    const only = codes.length === 1 ? costs.get(codes[0] ?? '') : undefined;
    if (only) costs.set(key, only);
  }

  return costs;
};

export default getOwnerWineCosts;
