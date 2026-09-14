import { sql } from 'drizzle-orm';
import type { SQLWrapper } from 'drizzle-orm';

/**
 * Pack-agnostic key for an LWIN18 column — wine + vintage + bottle size, with
 * the pack segment dropped (`1104653-2020-06-00750` → `1104653-2020-00750`).
 *
 * Prices in `wms_product_pricing` are all PER BOTTLE, so they belong to the
 * wine and vintage, not to the pack it happens to sit in. Repacking a priced
 * 6-pack into singles mints a `…-01-…` stock row; joining pricing on the exact
 * code leaves that row unpriced and the wine drops off the portals and reads as
 * "no price" in the Pricing Manager, while the full case it came from is still
 * priced. Joining on this key instead lets any pack inherit the price.
 *
 * Bottle size is deliberately kept — a magnum is a different physical thing and
 * must not inherit a 75cl price.
 *
 * @example
 *   sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(wmsStock.lwin18)}`
 *
 * @param col - A dashed LWIN18 column
 * @returns SQL fragment producing the pack-agnostic key
 */
const lwinPakKey = (col: SQLWrapper) =>
  sql`split_part(${col}, '-', 1) || '-' || split_part(${col}, '-', 2) || '-' || split_part(${col}, '-', 4)`;

export default lwinPakKey;

/**
 * The same key, computed in JavaScript
 *
 * Needed when the key has to be WRITTEN rather than joined on — a sale mandate
 * stores it so the catalogue can join live mandates by wine.
 *
 * **These two must produce identical output.** They are in one file so that a
 * change to either is made looking at the other; split across modules they
 * would drift, and the symptom would be a listed wine that silently fails to
 * price.
 *
 * @example
 *   lwinPakKeyOf('1104653-2020-06-00750'); // '1104653-2020-00750'
 *
 * @param lwin18 - A dashed LWIN18
 * @returns The pack-agnostic key
 */
export const lwinPakKeyOf = (lwin18: string) => {
  const parts = String(lwin18).split('-');

  return [parts[0] ?? '', parts[1] ?? '', parts[3] ?? ''].join('-');
};
