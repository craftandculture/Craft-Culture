import { client } from '@/database/client';

import { packAgnostic } from '../utils/codeBridge';
import tableReady from '../utils/tableReady';

/**
 * What each wine cost its owner, landed, as the Pricing Manager has it
 *
 * Import price plus cost override, matched pack-agnostically, the newest row
 * winning. Where no import price was typed and the caller asks, the shipment's
 * paid goods cost stands in, as it does in the Pricing Manager's own Import
 * column — the owner's own shipment first. This is what C&C owes a partner for a bottle of their consignment
 * that sells — the basis Sophie set for the partner statements — and it is
 * read here once so the monthly statement and a sale to a cellar member owe
 * the same partner the same figure.
 *
 * A wine with no import price is left out rather than returned as zero: an
 * unknown cost is a figure to find, never a free bottle.
 *
 * @example
 *   const landed = await getPricingManagerLanded([wineKey(lwin18)]);
 *
 * @param keys - Wine keys from `wineKey()`
 * @param options - `shipmentFallback` to stand in the shipment cost (the
 *   consignment statement); off for callers whose figures are already
 *   settled on the typed price, such as cellar partner debts. `partnerId`
 *   prefers that partner's own shipments.
 * @returns One landed cost per key that has one
 */
const getPricingManagerLanded = async (
  keys: string[],
  options: { shipmentFallback?: boolean; partnerId?: string | null } = {},
) => {
  const partnerId = options.partnerId ?? null;
  const fallback = options.shipmentFallback ?? false;
  /*
    A wine several owners hold may carry this owner's own import and override
    (wms_owner_product_pricing); theirs stands in for the shared row.
  */
  const perOwner =
    partnerId !== null && (await tableReady('wms_owner_product_pricing'));

  if (keys.length === 0) return [];

  /* Pack-agnostic key of a column, the one definition (`packAgnostic`) */
  const keyOf = (column: 'p.lwin18' | 'i.lwin') =>
    packAgnostic(
      () =>
        client`UPPER(REGEXP_REPLACE(${client.unsafe(column)}, '[^A-Za-z0-9]', '', 'g'))`,
    );

  return client<{ key: string; landedPerBottle: number; from: string }[]>`
    WITH typed AS (
      SELECT DISTINCT ON (key) key, import_price, override
      FROM (
        SELECT ${keyOf('p.lwin18')} AS key,
               p.import_price_per_bottle AS import_price,
               p.cost_override_per_bottle AS override,
               p.updated_at
        FROM wms_product_pricing p
        WHERE ${keyOf('p.lwin18')} = ANY(${keys}::text[])
      ) rows
      ORDER BY key, (import_price > 0) IS TRUE DESC, updated_at DESC NULLS LAST
    ),
    /*
      The Import column falls back to the shipment's paid goods cost when
      nobody typed a price, and so does this — the owner's own shipment first.
      Reading only the typed price left seventeen C&C wines in October with
      "no landed cost" that the Pricing Manager itself showed a cost for.
    */
    shipped AS (
      SELECT DISTINCT ON (key) key, product_cost, shipment_number
      FROM (
        SELECT ${keyOf('i.lwin')} AS key,
               i.product_cost_per_bottle AS product_cost,
               s.shipment_number,
               (s.partner_id = ${partnerId}::uuid) IS TRUE AS own,
               i.created_at
        FROM logistics_shipment_items i
        JOIN logistics_shipments s ON s.id = i.shipment_id
        WHERE ${fallback}
          AND i.lwin IS NOT NULL
          AND i.product_cost_per_bottle > 0
          AND ${keyOf('i.lwin')} = ANY(${keys}::text[])
      ) rows
      ORDER BY key, own DESC, created_at DESC
    ),
    owned AS (
      ${
        perOwner
          ? client`
              SELECT REPLACE(o.pak_key, '-', '') AS key,
                     o.import_price_per_bottle AS import_price,
                     o.cost_override_per_bottle AS override
              FROM wms_owner_product_pricing o
              WHERE o.owner_id = ${partnerId}::uuid
                AND REPLACE(o.pak_key, '-', '') = ANY(${keys}::text[])
            `
          : client`SELECT NULL::text AS key, NULL::float8 AS import_price, NULL::float8 AS override WHERE false`
      }
    ),
    priced AS (
      SELECT k.key,
             CASE WHEN o.key IS NOT NULL THEN o.import_price ELSE t.import_price END AS import_price,
             CASE WHEN o.key IS NOT NULL THEN o.override ELSE t.override END AS override,
             o.key IS NOT NULL AS own
      FROM UNNEST(${keys}::text[]) AS k(key)
      LEFT JOIN typed t ON t.key = k.key
      LEFT JOIN owned o ON o.key = k.key
    )
    SELECT p.key,
           (
             COALESCE(NULLIF(p.import_price, 0), sh.product_cost)
             + COALESCE(p.override, 0)
           )::float8 AS "landedPerBottle",
           CASE WHEN p.import_price > 0
                  THEN CASE WHEN p.own THEN 'Pricing Manager (this owner)' ELSE 'Pricing Manager' END
                ELSE 'Pricing Manager (shipment ' || sh.shipment_number || ')'
           END AS "from"
    FROM priced p
    LEFT JOIN shipped sh ON sh.key = p.key
    WHERE COALESCE(NULLIF(p.import_price, 0), sh.product_cost) IS NOT NULL
  `;
};

export default getPricingManagerLanded;
