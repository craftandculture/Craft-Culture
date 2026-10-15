import { sql } from 'drizzle-orm';

import { wmsStock } from '@/database/schema';

/**
 * The shipment line a stock row was costed from, as a LATERAL join named `ship`
 *
 * Exposes `ship.product_cost` (paid goods per bottle, ex-freight),
 * `ship.landed_cost` and `ship.own_line` for each `wms_stock` row in the query.
 *
 * A price used to be "the latest shipment line for this wine", matched on LWIN7,
 * vintage and size and nothing else. Two lots of one wine therefore shared one
 * cost, whichever arrived last:
 * - Arnoux-Lachaux village Chambolle 2021 (€234) took the Clos des Danguerins
 *   price (€481), because the two arrived on one invoice under one LWIN7 and
 *   differed only in the pack digits;
 * - Ihab's 2 cases of Montille Bourgogne Chardonnay took Crurated's cost for
 *   their 30, one product row with one price for two owners' stock.
 *
 * So the line is chosen for THIS stock row, most specific first:
 * 1. on the shipment the stock arrived on (which also fixes the owner),
 * 2. the same supplier SKU (Crurated W-codes tell two wines apart even when
 *    they were filed under one LWIN),
 * 3. the exact LWIN18, pack included,
 * 4. then the latest line for the wine anywhere — the old rule, kept only for
 *    stock with no shipment recorded, and for repacks, which have no line of
 *    their own and inherit the base wine's per-bottle cost.
 *
 * `ship.own_line` says the line is the stock's own (its shipment or its supplier
 * SKU) rather than a stand-in. An own line's invoice cost beats a typed import
 * price: Sophie's check of 15 Oct 2026 found 32 of 40 private-client lines
 * showing whole-dollar figures typed onto the shared per-wine row (Groffier
 * Bonnes Mares $700 against an invoice of $1,213), hiding the invoice entirely.
 *
 * The consignment payout needs the same answer — what this lot cost its owner —
 * so this is the one place it is decided.
 *
 * @example
 *   db.select({ cost: sql`ship.product_cost` })
 *     .from(wmsStock)
 *     .leftJoin(lotShipmentCost, sql`true`);
 */
const lotShipmentCost = sql`LATERAL (
  SELECT i.product_cost_per_bottle AS product_cost,
         i.landed_cost_per_bottle AS landed_cost,
         -- true when this is the stock's own invoice line, not a stand-in
         (i.shipment_id = ${wmsStock.shipmentId}
           OR NULLIF(i.supplier_sku, '') = NULLIF(${wmsStock.supplierSku}, '')) IS TRUE AS own_line
  FROM logistics_shipment_items i
  WHERE i.lwin IS NOT NULL
    AND split_part(i.lwin, '-', 1) || '-' || split_part(i.lwin, '-', 2) || '-' || split_part(i.lwin, '-', 4)
      = split_part(${wmsStock.lwin18}, '-', 1) || '-' || split_part(${wmsStock.lwin18}, '-', 2) || '-' || split_part(${wmsStock.lwin18}, '-', 4)
  ORDER BY
    (i.shipment_id = ${wmsStock.shipmentId}) IS TRUE DESC,
    (NULLIF(i.supplier_sku, '') = NULLIF(${wmsStock.supplierSku}, '')) IS TRUE DESC,
    (i.lwin = ${wmsStock.lwin18}) DESC,
    i.created_at DESC
  LIMIT 1
) ship`;

export default lotShipmentCost;
