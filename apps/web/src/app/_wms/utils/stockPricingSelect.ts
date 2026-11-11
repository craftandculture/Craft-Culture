import { sql } from 'drizzle-orm';

import {
  wmsOwnerPricingSettings,
  wmsStock,
} from '@/database/schema';

import { ownerPriced } from './ownerPricingJoin';

/**
 * Everything a price is built from, for one wine held by one owner
 *
 * The Pricing Manager and the price lists both select these, so the two can
 * only ever be fed the same figures. They used not to: the price list grouped
 * by wine alone and took the highest of each input across every lot and every
 * owner, so it priced one owner's import with another's margin, and a wine
 * bought twice took the dearer invoice where the Pricing Manager took the
 * newest. A wine whose list price differed from its Pricing Manager price was
 * the result.
 *
 * Use in a query over `wms_stock` grouped by `(lwin18, owner_id)`, joined to
 * `wms_product_pricing` pack-agnostically, `ownerPricingJoin` (`opp`),
 * `wms_owner_pricing_settings` on the owner and `lotShipmentCost` (`ship`).
 * Turn the result into a price with `stockPricingInput` and then
 * `pricePricingManagerRow`.
 *
 * @example
 *   db.select({ lwin18: wmsStock.lwin18, ...stockPricingSelect })
 *     .from(wmsStock)
 *     // …the joins above…
 *     .groupBy(wmsStock.lwin18, wmsStock.ownerId);
 */
const stockPricingSelect = {
  /* The newest lot's paid and landed cost — see lotShipmentCost */
  lotProductCost: sql<
    number | null
  >`(array_agg(ship.product_cost ORDER BY ${wmsStock.receivedAt} DESC NULLS LAST))[1]`,
  lotLandedCost: sql<
    number | null
  >`(array_agg(ship.landed_cost ORDER BY ${wmsStock.receivedAt} DESC NULLS LAST))[1]`,
  lotOwnLine: sql<
    boolean | null
  >`(array_agg(ship.own_line ORDER BY ${wmsStock.receivedAt} DESC NULLS LAST))[1]`,
  category: sql<string | null>`MAX(${wmsStock.category})`,
  /* 1 when Craft & Culture owns the stock: the $22.50 wine logistics fallback */
  isCraftCulture: sql<number>`MAX(CASE WHEN ${wmsStock.ownerName} ILIKE '%craft%culture%' THEN 1 ELSE 0 END)::int`,
  /* 1 for Cru Wine / Crurated, whose transfer fee defaults to $0, not $2.50 */
  isZeroTransferOwner: sql<number>`MAX(CASE WHEN ${wmsStock.ownerName} ILIKE '%cru wine%' OR ${wmsStock.ownerName} ILIKE '%crurated%' THEN 1 ELSE 0 END)::int`,
  importPricePerBottle: sql<
    number | null
  >`MAX(${ownerPriced('importPricePerBottle')})`,
  costOverridePerBottle: sql<
    number | null
  >`MAX(${ownerPriced('costOverridePerBottle')})`,
  /* Per-line logistics override ($/btl); null = live freight or fallback */
  lineLogistics: sql<
    number | null
  >`MAX(${ownerPriced('logisticsPerBottle')})`,
  /* Per-line FZ→mainland transfer fee ($/btl); null = the owner's default */
  transferPricePerBottle: sql<
    number | null
  >`MAX(${ownerPriced('transferPricePerBottle')})`,
  sellingPricePerBottle: sql<
    number | null
  >`MAX(${ownerPriced('sellingPricePerBottle')})`,
  /* A spirit's old single margin, read as its In Bond margin */
  sellMarginPct: sql<number | null>`MAX(${ownerPriced('sellMarginPct')})`,
  /* Margins typed on this line, which beat the owner's rates */
  b2bMarginPct: sql<number | null>`MAX(${ownerPriced('b2bMarginPct')})`,
  pcMarginPct: sql<number | null>`MAX(${ownerPriced('pcMarginPct')})`,
  /* The owner's own rates; null when the owner has set none */
  ownerLogistics: sql<
    number | null
  >`MAX(${wmsOwnerPricingSettings.logisticsPerBottle})`,
  ownerInbondPct: sql<
    number | null
  >`MAX(${wmsOwnerPricingSettings.inbondMarginPct})`,
  ownerPcPct: sql<number | null>`MAX(${wmsOwnerPricingSettings.pcMarginPct})`,
};

export default stockPricingSelect;
