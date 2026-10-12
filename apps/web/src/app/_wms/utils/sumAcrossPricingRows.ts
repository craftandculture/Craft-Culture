import { sql } from 'drizzle-orm';
import type { SQLWrapper } from 'drizzle-orm';

import { wmsProductPricing } from '@/database/schema';

/**
 * Sum a quantity in a query that joins `wms_product_pricing` pack-agnostically
 *
 * A wine can hold more than one pricing row — one minted per pack before writes
 * were keyed on the wine — and the pack-agnostic join matches all of them, so
 * every stock row comes back once per pricing row. Prices survive that, because
 * they are read with `MAX()`. A plain `SUM()` does not: Solaia 2022 held 20
 * cases and showed 40, because its 3-pack and 6-pack each had a pricing row.
 *
 * Every row in a group shares the wine, so every row is repeated the same
 * number of times, and dividing by that number gives the true total back
 * exactly.
 *
 * Only valid where the group is a single wine (grouped by LWIN18 or by the
 * pack-agnostic key). A total across several wines needs the join itself
 * reduced to one pricing row per wine.
 *
 * @example
 *   totalCases: sql<number>`${sumAcrossPricingRows(wmsStock.quantityCases)}::int`,
 *
 * @param expr - The per-row quantity to total
 * @returns SQL fragment producing the total, counted once per stock row
 */
const sumAcrossPricingRows = (expr: SQLWrapper) =>
  sql`(SUM(${expr}) / GREATEST(COUNT(DISTINCT ${wmsProductPricing.id}), 1))`;

export default sumAcrossPricingRows;
