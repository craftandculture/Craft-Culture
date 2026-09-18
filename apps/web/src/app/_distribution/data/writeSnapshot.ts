import type { Sql } from 'postgres';

import type { ParsedCityDrinksStock } from '../utils/parseCityDrinksStock';

/**
 * Record an outlet's position as at a moment
 *
 * Takes its database client rather than importing one. The scheduled job runs
 * outside the app's environment — `@/database/client` validates every server
 * variable at import, which is why `triggerDb` exists at all — so a function
 * that reaches for a client of its own can only be called from one of the two
 * places that need it.
 *
 * Re-running for the same moment replaces that snapshot rather than adding to
 * it: the feed is regenerated on a schedule, so two pulls between
 * regenerations carry the identical `generated_at` and appending would double
 * the position.
 *
 * Both regimes are stored, not just consignment. A line moving from consigned
 * to bought is a purchase, and keeping only the consigned rows would make it
 * look like stock disappearing — which would then be billed to its owner as a
 * sale that never happened.
 *
 * @param sql - The postgres client to write through
 * @param outletId - Which outlet this position belongs to
 * @param parsed - The snapshot as read from the feed
 * @returns How many rows were written, and what was worth noticing
 */
const writeSnapshot = async (
  sql: Sql,
  outletId: string,
  parsed: ParsedCityDrinksStock,
) => {
  await sql`
    DELETE FROM cons_snapshots
    WHERE outlet_id = ${outletId} AND taken_at = ${parsed.takenAt}
  `;

  if (parsed.rows.length > 0) {
    const values = parsed.rows.map((row) => ({
      outlet_id: outletId,
      taken_at: parsed.takenAt,
      outlet_code: row.outletCode,
      our_code: row.ourCode,
      product_name: row.productName,
      bottles_on_hand: row.bottlesOnHand,
      bottles_in_transit: row.bottlesInTransit,
      regime: row.regime,
      sold_last_30d: row.soldLast30d,
      sold_last_90d: row.soldLast90d,
    }));

    /*
      postgres.js builds the multi-row insert and binds each value by its own
      type, so a Date goes in as a timestamp. The generic helper in
      `_triangulation` binds through `client.unsafe`, which rejects a Date
      outright — the first live pull fetched all 389 products and then failed
      on the write for exactly that reason.
    */
    await sql`INSERT INTO cons_snapshots ${sql(values)}`;
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
