import { inArray, sql } from 'drizzle-orm';

import lwinPakKey, { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import { logisticsShipmentItems, wmsProductPricing } from '@/database/schema';

/**
 * What a bottle was declared at on import, keyed pack-agnostically
 *
 * Prices in `wms_product_pricing` are per bottle, so they belong to the wine,
 * vintage and bottle size — not to the pack the stock happens to sit in. Both
 * the member's estimate and the admin quote joined on the exact LWIN18, so a
 * 2-pack repacked out of a priced 6-pack found no price at all.
 *
 * The consequence was quiet and expensive: `goodsValueUsd` came out at zero, and
 * every percentage on the rate card — duty, the distributor's cut, C&C's own
 * margin — is taken on that value. A release of four bottles quoted at the
 * transfer fee and half a dollar of VAT, and the rate card looked broken when it
 * was the lookup that had missed.
 *
 * Returns a map keyed by `lwinPakKeyOf`, so callers must key their lookups the
 * same way rather than by the raw code.
 *
 * @example
 *   const costs = await getCostPerBottle(lwins);
 *   const cost = costs.get(lwinPakKeyOf(stock.lwin18)) ?? null;
 *
 * @param lwins - The LWIN18s being priced
 * @returns Cost per bottle, keyed pack-agnostically
 */
const getCostPerBottle = async (lwins: string[]) => {
  if (lwins.length === 0) return new Map<string, number>();

  const rows = await db
    .select({
      key: sql<string>`${lwinPakKey(wmsProductPricing.lwin18)}`,
      cost: sql<number | null>`COALESCE(
        NULLIF(MAX(${wmsProductPricing.importPricePerBottle}), 0),
        MAX(${logisticsShipmentItems.productCostPerBottle})
      )`,
    })
    .from(wmsProductPricing)
    .leftJoin(
      logisticsShipmentItems,
      sql`${lwinPakKey(logisticsShipmentItems.lwin)} = ${lwinPakKey(wmsProductPricing.lwin18)}`,
    )
    .where(
      inArray(
        sql`${lwinPakKey(wmsProductPricing.lwin18)}`,
        lwins.map((lwin) => lwinPakKeyOf(lwin)),
      ),
    )
    .groupBy(sql`${lwinPakKey(wmsProductPricing.lwin18)}`);

  return new Map(rows.map((row) => [row.key, Number(row.cost ?? 0)]));
};

export default getCostPerBottle;
