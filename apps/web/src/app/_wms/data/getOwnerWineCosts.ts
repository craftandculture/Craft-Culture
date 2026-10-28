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
 * a cost. Keyed by the pack-agnostic wine key.
 *
 * @example
 *   const costs = await getOwnerWineCosts(ownerId);
 *   costs.get(lwinPakKeyOf(lwin18))?.landedPerBottle;
 *
 * @param ownerId - The owner
 * @returns Map of wine key → { importPerBottle, landedPerBottle }
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
    const key = lwinPakKeyOf(row.lwin18);
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

  return costs;
};

export default getOwnerWineCosts;
