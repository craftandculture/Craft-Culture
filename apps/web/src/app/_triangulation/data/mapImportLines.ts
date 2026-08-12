import { client } from '@/database/client';

import recalculateLineBottles from './recalculateLineBottles';
import type { TriAliasSource } from '../schemas/triangulationSchemas';


/**
 * Resolve every line of an import to a canonical W code SKU
 *
 * Matching runs in two passes: first the alias table for the party whose codes
 * the file uses (City Drinks' CD codes, Zoho item codes), then a direct match
 * on the W code itself for files that already speak our internal language.
 *
 * Safe to re-run — it clears and recomputes the mapping, so resolving a new
 * alias and replaying this brings older draft imports up to date.
 *
 * @param importId - The import whose lines should be mapped
 * @param source - Which party's codes the `raw_code` column holds
 * @returns Row counts and the recomputed bottle total for the import
 */
const mapImportLines = async (importId: string, source: TriAliasSource) => {
  // Reset so a removed alias cannot leave a stale mapping behind.
  await client`
    UPDATE tri_import_lines
    SET sku_id = NULL, status = 'unmapped', updated_at = NOW()
    WHERE import_id = ${importId} AND status <> 'ignored'
  `;

  await client`
    UPDATE tri_import_lines l
    SET sku_id = m.sku_id, status = 'mapped', updated_at = NOW()
    FROM (
      SELECT l2.id, COALESCE(a.sku_id, s.id) AS sku_id
      FROM tri_import_lines l2
      LEFT JOIN tri_sku_aliases a
        ON a.source = ${source}
        AND a.normalized_code = l2.normalized_code
      LEFT JOIN tri_skus s
        ON UPPER(REGEXP_REPLACE(s.w_code, '[^A-Za-z0-9]', '', 'g')) = l2.normalized_code
      WHERE l2.import_id = ${importId}
        AND l2.status <> 'ignored'
        AND l2.normalized_code IS NOT NULL
        AND l2.normalized_code <> ''
    ) m
    WHERE l.id = m.id AND m.sku_id IS NOT NULL
  `;

  // Case-denominated lines that did not state a pack size inherit it from the
  // SKU now that we know which SKU they are.
  await recalculateLineBottles(importId);

  const [totals] = await client<
    { rowCount: number; mappedRowCount: number; totalBottles: number }[]
  >`
    SELECT
      COUNT(*)::int AS "rowCount",
      COUNT(*) FILTER (WHERE status = 'mapped')::int AS "mappedRowCount",
      COALESCE(SUM(quantity_bottles) FILTER (WHERE status = 'mapped'), 0)::float8
        AS "totalBottles"
    FROM tri_import_lines
    WHERE import_id = ${importId}
  `;

  const rowCount = totals?.rowCount ?? 0;
  const mappedRowCount = totals?.mappedRowCount ?? 0;
  const totalBottles = totals?.totalBottles ?? 0;

  await client`
    UPDATE tri_imports
    SET row_count = ${rowCount},
        mapped_row_count = ${mappedRowCount},
        total_bottles = ${totalBottles},
        updated_at = NOW()
    WHERE id = ${importId}
  `;

  return { rowCount, mappedRowCount, totalBottles };
};

export default mapImportLines;
