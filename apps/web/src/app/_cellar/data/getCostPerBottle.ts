import { inArray, sql } from 'drizzle-orm';

import lwinPakKey, { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import { logisticsShipmentItems, wmsProductPricing } from '@/database/schema';

/**
 * What a bottle was declared at on import
 *
 * One lookup, because this was written three times and the copies did not
 * agree. Two things it has to get right, both of which a copy got wrong:
 *
 * **Pack-agnostic.** Prices are per bottle and belong to the wine, vintage and
 * bottle size, not the pack the stock sits in. Joining on the exact LWIN18 left
 * a 2-pack repacked out of a priced 6-pack with no price at all — which made
 * `goodsValueUsd` zero, and duty, the distributor's cut and C&C's margin are
 * all percentages of that.
 *
 * **The shipment fallback must fire without a pricing row.** Querying `FROM
 * wms_product_pricing` and left-joining the shipment means a wine that was
 * imported with a cost but never priced in the Pricing Manager returns nothing,
 * because there is no pricing row to hang the join on. The two sources are read
 * separately and merged, so either alone is enough.
 *
 * Returns a map keyed by `lwinPakKeyOf`, so callers cannot quietly key it by
 * the raw code.
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

  const keys = [...new Set(lwins.map((lwin) => lwinPakKeyOf(lwin)))];

  const [priced, shipped] = await Promise.all([
    db
      .select({
        key: sql<string>`${lwinPakKey(wmsProductPricing.lwin18)}`,
        cost: sql<number | null>`NULLIF(MAX(${wmsProductPricing.importPricePerBottle}), 0)`,
      })
      .from(wmsProductPricing)
      .where(inArray(sql`${lwinPakKey(wmsProductPricing.lwin18)}`, keys))
      .groupBy(sql`${lwinPakKey(wmsProductPricing.lwin18)}`),

    db
      .select({
        key: sql<string>`${lwinPakKey(logisticsShipmentItems.lwin)}`,
        cost: sql<number | null>`NULLIF(MAX(${logisticsShipmentItems.productCostPerBottle}), 0)`,
      })
      .from(logisticsShipmentItems)
      .where(inArray(sql`${lwinPakKey(logisticsShipmentItems.lwin)}`, keys))
      .groupBy(sql`${lwinPakKey(logisticsShipmentItems.lwin)}`),
  ]);

  /*
    Shipment first, then pricing over the top — a price set deliberately in the
    Pricing Manager beats what a supplier happened to invoice.
  */
  const costs = new Map<string, number>();

  for (const row of shipped) {
    if (row.cost) costs.set(row.key, Number(row.cost));
  }

  for (const row of priced) {
    if (row.cost) costs.set(row.key, Number(row.cost));
  }

  return costs;
};

export default getCostPerBottle;
