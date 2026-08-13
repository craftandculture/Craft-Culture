import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import wineIdentity from '../utils/wineIdentity';

export interface SplitSku {
  aId: string;
  aWCode: string;
  aName: string;
  aVintage: number | null;
  aLines: number;
  aBottles: number;
  bId: string;
  bWCode: string;
  bName: string;
  bVintage: number | null;
  bLines: number;
  bBottles: number;
  score: number;
}

/**
 * One wine registered under two W codes, splitting its own figures
 *
 * Zoho carried the same rum as "RUM Dictador x Crurated…" and "Dictador x
 * Crurated…", which put two invoices on one SKU and a third on another. The
 * reconciliation was not wrong — it faithfully reported a SKU that was missing
 * two bottles — but the cause was invisible, and it took an invoice PDF and a
 * long conversation to find.
 *
 * A split identity is worth finding before it is read as a variance, because it
 * understates one side and overstates nothing: the missing bottles simply sit
 * somewhere else, looking unremarkable.
 *
 * Pairs are reported when the names are close and the vintages do not
 * contradict. It suggests, never merges — two vintages of one wine, or a magnum
 * beside a bottle, are legitimately separate SKUs and only someone who knows
 * the range can tell which is which.
 */
const adminFindSplitSkus = adminProcedure.query(async () => {
  const pairs = await client<SplitSku[]>`
    WITH activity AS (
      SELECT
        s.id,
        s.w_code,
        s.product_name,
        s.vintage,
        COUNT(l.id)::int AS lines,
        COALESCE(SUM(l.quantity_bottles), 0)::float8 AS bottles
      FROM tri_skus s
      LEFT JOIN tri_import_lines l ON l.sku_id = s.id
      GROUP BY s.id, s.w_code, s.product_name, s.vintage
    )
    SELECT
      a.id AS "aId", a.w_code AS "aWCode", a.product_name AS "aName",
      a.vintage AS "aVintage", a.lines AS "aLines", a.bottles AS "aBottles",
      b.id AS "bId", b.w_code AS "bWCode", b.product_name AS "bName",
      b.vintage AS "bVintage", b.lines AS "bLines", b.bottles AS "bBottles",
      similarity(a.product_name, b.product_name)::float8 AS score
    FROM activity a
    JOIN activity b
      -- a.id < b.id reports each pair once rather than in both directions
      ON b.id > a.id
      AND similarity(a.product_name, b.product_name) > 0.6
      -- Vintage and size are checked below, from the names: the columns are
      -- usually empty, so filtering on them here finds nothing.
    -- Only pairs where something actually moved: an unused duplicate in the
    -- registry costs nothing and would bury the ones that are splitting figures.
    WHERE a.lines > 0 OR b.lines > 0
    ORDER BY similarity(a.product_name, b.product_name) DESC
    LIMIT 400
  `;

  // Two SKUs are one wine only when the vintage matches, the bottle size
  // matches, and what is left of the name after removing both is effectively
  // identical. Name similarity alone flags "2021" against "2020", a magnum
  // against a bottle, and a village wine against its 1er cru — all of which are
  // legitimately separate SKUs, and merging any of them destroys real data.
  return pairs
    .map((pair) => {
      const a = wineIdentity(pair.aName, pair.aVintage, null);
      const b = wineIdentity(pair.bName, pair.bVintage, null);

      return { pair, a, b };
    })
    .filter(({ pair, a, b }) => {
      if (a.vintage !== null && b.vintage !== null && a.vintage !== b.vintage) {
        return false;
      }

      if (a.sizeMl !== null && b.sizeMl !== null && a.sizeMl !== b.sizeMl) {
        return false;
      }

      // One name containing the other is the village-vs-1er-cru case: the extra
      // words are what make it a different wine, not noise.
      if (a.base !== b.base) {
        return false;
      }

      return pair.score > 0.6;
    })
    .map(({ pair }) => pair);
});

export default adminFindSplitSkus;
