import type { Sql } from 'postgres';

import bundlesFromFeed from './bundlesFromFeed';
import type { CityDrinksRow } from '../../_distribution/utils/parseCityDrinksStock';


/**
 * Fill PCOs' distributor SKU from the distributor's own stock feed
 *
 * City Drinks' feed already lists each PCO bundle it has created, named by
 * PCO number, with the CDR SKU its system uses. Where one of our orders for
 * that distributor has no SKU yet, it takes the feed's. A SKU someone typed is
 * never overwritten — a disagreement is shown on the order, not settled here.
 *
 * Raw SQL on a passed client, like `writeSnapshot`, so the daily Trigger.dev
 * pull and the app share this one implementation.
 *
 * @param sql - A postgres.js client (the app's or Trigger.dev's)
 * @param options.outletId - The distributor's outlet (`cons_outlets`)
 * @param options.rows - Feed rows from a live pull; the latest snapshot if omitted
 * @param options.orderNumbers - Only these orders; every order if omitted
 * @returns How many orders were filled, and PCOs left alone as ambiguous
 */
const linkBundleSkusFromFeed = async (
  sql: Sql,
  options: {
    outletId: string;
    rows?: Pick<CityDrinksRow, 'outletCode' | 'ourCode' | 'productName' | 'regime'>[];
    orderNumbers?: string[];
  },
) => {
  const [outlet] = await sql<{ partnerId: string | null }[]>`
    SELECT partner_id AS "partnerId" FROM cons_outlets WHERE id = ${options.outletId}
  `;

  // A feed not yet tied to its distributor cannot say whose orders these are
  if (!outlet?.partnerId) return { linked: 0, ambiguous: [] as string[] };

  const rows =
    options.rows ??
    (await sql<
      { outletCode: string; ourCode: string | null; productName: string; regime: 'consigned' | 'bought' }[]
    >`
      SELECT outlet_code AS "outletCode", our_code AS "ourCode",
             COALESCE(product_name, '') AS "productName", regime
      FROM cons_snapshots
      WHERE outlet_id = ${options.outletId}
        AND taken_at = (SELECT MAX(taken_at) FROM cons_snapshots WHERE outlet_id = ${options.outletId})
    `);

  const { bundles, ambiguous } = bundlesFromFeed(rows);
  const wanted = options.orderNumbers
    ? new Set(options.orderNumbers.map((n) => n.toUpperCase()))
    : null;

  let linked = 0;
  for (const bundle of bundles) {
    if (wanted && !wanted.has(bundle.orderNumber)) continue;

    const updated = await sql`
      UPDATE private_client_orders
      SET distributor_sku = ${bundle.sku},
          distributor_ref = ${bundle.ref},
          distributor_sku_source = 'cd_feed',
          distributor_sku_set_at = NOW(),
          distributor_sku_set_by = NULL
      WHERE order_number = ${bundle.orderNumber}
        AND distributor_id = ${outlet.partnerId}
        AND distributor_sku IS NULL
      RETURNING id
    `;
    linked += updated.length;
  }

  return { linked, ambiguous };
};

export default linkBundleSkusFromFeed;
