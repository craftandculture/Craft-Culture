import { sql } from 'drizzle-orm';

import { wmsProductPricing, wmsStock } from '@/database/schema';

import lwinPakKey from './lwinPakKey';

/** Column on `wms_owner_product_pricing` for each field read through it */
const COLUMNS = {
  importPricePerBottle: 'import_price_per_bottle',
  costOverridePerBottle: 'cost_override_per_bottle',
  logisticsPerBottle: 'logistics_per_bottle',
  transferPricePerBottle: 'transfer_price_per_bottle',
  sellingPricePerBottle: 'selling_price_per_bottle',
  sellMarginPct: 'sell_margin_pct',
  b2bMarginPct: 'b2b_margin_pct',
  pcMarginPct: 'pc_margin_pct',
} as const;

export type OwnerPricedField = keyof typeof COLUMNS;

/**
 * The stock owner's own pricing row of this wine, as a lateral join (`opp`)
 *
 * Joined beside `wms_product_pricing` wherever stock is priced, with
 * `.leftJoin(ownerPricingJoin(ready), sql\`true\`)`. Every column it adds is
 * prefixed `opp_`, so none can shadow a bare column name elsewhere in the
 * query (a clash of exactly that kind once emptied the price list). When the table is not
 * there yet the join is an empty row of the same shape, so the query never
 * names a table that does not exist — the failure that once emptied the
 * Pricing Manager.
 *
 * @example
 *   .leftJoin(ownerPricingJoin(await ownerPricingReady()), sql`true`)
 *
 * @param ready - Whether `wms_owner_product_pricing` exists
 * @returns The lateral join fragment
 */
const ownerPricingJoin = (ready: boolean) =>
  ready
    ? sql`LATERAL (
        SELECT o.id AS opp_id, ${sql.raw(
          Object.values(COLUMNS)
            .map((column) => `o.${column} AS opp_${column}`)
            .join(', '),
        )}
        FROM wms_owner_product_pricing o
        WHERE o.owner_id = ${wmsStock.ownerId}
          AND o.pak_key = ${lwinPakKey(wmsStock.lwin18)}
        LIMIT 1
      ) opp`
    : sql`LATERAL (
        SELECT NULL::uuid AS opp_id, ${sql.raw(
          Object.values(COLUMNS)
            .map((column) => `NULL::float8 AS opp_${column}`)
            .join(', '),
        )}
      ) opp`;

/**
 * A pricing field as the stock owner sees it: their own row where they have
 * one, otherwise the wine's shared row
 *
 * The whole owner row stands in, not field by field: once a shared wine is
 * forked an owner clearing an override means cleared, not "inherit Ihab's".
 *
 * @example
 *   sql`MAX(${ownerPriced('costOverridePerBottle')})`
 *
 * @param field - The pricing field
 * @returns The SQL for it
 */
export const ownerPriced = (field: OwnerPricedField) =>
  sql`(CASE WHEN opp.opp_id IS NOT NULL THEN opp.${sql.raw(`opp_${COLUMNS[field]}`)} ELSE ${wmsProductPricing[field]} END)`;

export default ownerPricingJoin;
