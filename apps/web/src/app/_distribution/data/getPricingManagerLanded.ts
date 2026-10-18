import { client } from '@/database/client';

import { packAgnostic } from '../utils/codeBridge';

/**
 * What each wine cost its owner, landed, as the Pricing Manager has it
 *
 * Import price plus cost override, matched pack-agnostically, the newest row
 * winning. This is what C&C owes a partner for a bottle of their consignment
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
 * @returns One landed cost per key that has one
 */
const getPricingManagerLanded = async (keys: string[]) => {
  if (keys.length === 0) return [];

  return client<{ key: string; landedPerBottle: number }[]>`
    SELECT DISTINCT ON (key)
           ${packAgnostic(
             () => client`UPPER(REGEXP_REPLACE(p.lwin18, '[^A-Za-z0-9]', '', 'g'))`,
           )} AS key,
           (
             p.import_price_per_bottle
             + COALESCE(p.cost_override_per_bottle, 0)
           )::float8 AS "landedPerBottle"
    FROM wms_product_pricing p
    WHERE p.import_price_per_bottle IS NOT NULL
      AND p.import_price_per_bottle > 0
      AND ${packAgnostic(
        () => client`UPPER(REGEXP_REPLACE(p.lwin18, '[^A-Za-z0-9]', '', 'g'))`,
      )} = ANY(${keys}::text[])
    ORDER BY key, p.updated_at DESC NULLS LAST
  `;
};

export default getPricingManagerLanded;
