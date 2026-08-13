import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import wineIdentity from '../utils/wineIdentity';

interface MappedLine {
  skuId: string;
  wCode: string;
  productName: string;
  skuVintage: number | null;
  normalizedCode: string;
  rawCode: string | null;
  rawDescription: string;
  lines: number;
  bottles: number;
}

export interface MismatchedGroup extends MappedLine {
  /** What disagrees: the vintage, the bottle size, or both */
  reason: string;
}

/**
 * Lines counted against a SKU whose name says they are a different wine
 *
 * A wrong mapping is silent by construction: the bottles land on a real SKU and
 * every figure stays plausible. That covers a mis-merged pair, a bad manual
 * map, and anything auto-map took that it should not have — the same signature
 * in each case, which is a line whose own description states a vintage or a
 * bottle size the SKU does not have.
 *
 * Comparing names would be useless here, since a mapping exists precisely
 * because the names differ. Vintage and size are the two attributes that make a
 * genuinely different SKU, so those are what is checked.
 */
const adminFindMismatchedLines = adminProcedure.query(async () => {
  const groups = await client<MappedLine[]>`
    SELECT
      s.id AS "skuId",
      s.w_code AS "wCode",
      s.product_name AS "productName",
      s.vintage AS "skuVintage",
      l.normalized_code AS "normalizedCode",
      MIN(l.raw_code) AS "rawCode",
      MIN(l.raw_description) AS "rawDescription",
      COUNT(*)::int AS lines,
      COALESCE(SUM(l.quantity_bottles), 0)::float8 AS bottles
    FROM tri_import_lines l
    JOIN tri_skus s ON s.id = l.sku_id
    WHERE l.status = 'mapped'
      AND COALESCE(l.raw_description, '') <> ''
    GROUP BY s.id, s.w_code, s.product_name, s.vintage, l.normalized_code
  `;

  return groups
    .map((group) => {
      const sku = wineIdentity(group.productName, group.skuVintage, null);
      const line = wineIdentity(group.rawDescription, null, null);

      const vintageClash =
        sku.vintage !== null && line.vintage !== null && sku.vintage !== line.vintage;
      const sizeClash =
        sku.sizeMl !== null && line.sizeMl !== null && sku.sizeMl !== line.sizeMl;

      const reason = [
        vintageClash ? `vintage ${line.vintage} vs ${sku.vintage}` : null,
        sizeClash ? `size ${line.sizeMl}ml vs ${sku.sizeMl}ml` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      return { ...group, reason };
    })
    .filter((group) => group.reason !== '')
    .sort((a, b) => b.bottles - a.bottles)
    .slice(0, 100);
});

export default adminFindMismatchedLines;
