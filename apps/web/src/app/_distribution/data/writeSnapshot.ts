import insertRows from '@/app/_triangulation/data/insertRows';
import { client } from '@/database/client';


import type { ParsedCityDrinksStock } from '../utils/parseCityDrinksStock';

/**
 * Record an outlet's position as at a moment
 *
 * Re-running for the same moment replaces that snapshot rather than adding to
 * it: the feed is regenerated on a schedule, so two pulls between regenerations
 * carry the identical `generated_at` and appending would double the position.
 *
 * Both regimes are stored. A line moving from consigned to bought is a
 * purchase, and only having the consigned rows would make it look like stock
 * disappearing — which would then be billed to its owner as a sale.
 *
 * @param outletId - Which outlet this position belongs to
 * @param parsed - The snapshot as read from the feed
 * @returns How many rows were written, and what was worth noticing
 */
const writeSnapshot = async (
  outletId: string,
  parsed: ParsedCityDrinksStock,
) => {
  /*
    The same instant in both statements, as a string.

    insertRows binds through `client.unsafe`, which does not serialise a Date
    the way a tagged template does — it rejects one outright. Converting here
    rather than teaching the shared helper about dates keeps the change inside
    this module, and using the identical value in the DELETE guarantees the
    replace actually matches what the insert wrote.
  */
  const takenAt = parsed.takenAt.toISOString();

  await client`
    DELETE FROM cons_snapshots
    WHERE outlet_id = ${outletId} AND taken_at = ${takenAt}
  `;

  if (parsed.rows.length > 0) {
    await insertRows(
      'cons_snapshots',
      [
        'outlet_id',
        'taken_at',
        'outlet_code',
        'our_code',
        'product_name',
        'bottles_on_hand',
        'bottles_in_transit',
        'regime',
        'sold_last_30d',
        'sold_last_90d',
      ],
      parsed.rows.map((row) => ({
        outlet_id: outletId,
        taken_at: takenAt,
        outlet_code: row.outletCode,
        our_code: row.ourCode,
        product_name: row.productName,
        bottles_on_hand: row.bottlesOnHand,
        bottles_in_transit: row.bottlesInTransit,
        regime: row.regime,
        sold_last_30d: row.soldLast30d,
        sold_last_90d: row.soldLast90d,
      })),
    );
  }

  return {
    takenAt: parsed.takenAt,
    written: parsed.rows.length,
    ...parsed.counts,
    unmatched: parsed.unmatched.map(
      (row) => `${row.outletCode} — ${row.productName}`,
    ),
  };
};

export default writeSnapshot;
