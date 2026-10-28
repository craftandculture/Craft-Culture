import { client } from '@/database/client';

import backfillDescriptionKeys from './backfillDescriptionKeys';
import recalculateLineBottles from './recalculateLineBottles';
import type { SqlClient } from './sqlClient';
import type { TriAliasSource } from '../schemas/triangulationSchemas';


/**
 * Resolve every line of an import to a canonical W code SKU
 *
 * Three things are tried in order of authority: the alias table for the party
 * whose codes the file uses (City Drinks' CD codes), the W code itself for
 * files that already speak our internal language, and finally the LWIN — which
 * is how the in-house feeds identify a wine, since Zoho SKUs and WMS cycle
 * counts are keyed on LWIN rather than on a W code.
 *
 * Safe to re-run — it clears and recomputes the mapping, so resolving a new
 * alias and replaying this brings older draft imports up to date.
 *
 * Every lookup is confined to the import's own programme. Two clients can
 * share a code (or an LWIN), and resolving one client's line against the
 * other's registry moved bottles out of both reconciliations.
 *
 * An import in a locked period is left exactly as it is: the period was signed
 * off on those mappings, and re-mapping it would let the agreed figures drift.
 *
 * @param importId - The import whose lines should be mapped
 * @param source - Which party's codes the `raw_code` column holds
 * @param sql - A transaction to run inside, when the caller is swapping a feed
 * @returns Row counts and the recomputed bottle total for the import
 */
const mapImportLines = async (
  importId: string,
  source: TriAliasSource,
  sql: SqlClient = client,
) => {
  const [record] = await sql<{ programmeId: string; locked: boolean }[]>`
    SELECT i.programme_id AS "programmeId",
           COALESCE(p.status = 'locked', false) AS locked
    FROM tri_imports i
    LEFT JOIN tri_periods p ON p.id = i.period_id
    WHERE i.id = ${importId}
  `;

  if (!record) {
    return { rowCount: 0, mappedRowCount: 0, totalBottles: 0, locked: false };
  }

  if (record.locked) {
    const [frozen] = await sql<
      { rowCount: number; mappedRowCount: number; totalBottles: number }[]
    >`
      SELECT row_count AS "rowCount", mapped_row_count AS "mappedRowCount",
             total_bottles AS "totalBottles"
      FROM tri_imports WHERE id = ${importId}
    `;
    return {
      rowCount: frozen?.rowCount ?? 0,
      mappedRowCount: frozen?.mappedRowCount ?? 0,
      totalBottles: frozen?.totalBottles ?? 0,
      locked: true,
    };
  }

  const { programmeId } = record;

  // Codeless lines key on their description — see backfillDescriptionKeys.
  await backfillDescriptionKeys(importId, sql);

  // Reset so a removed alias cannot leave a stale mapping behind.
  await sql`
    UPDATE tri_import_lines
    SET sku_id = NULL, status = 'unmapped', updated_at = NOW()
    WHERE import_id = ${importId} AND status <> 'ignored'
  `;

  await sql`
    UPDATE tri_import_lines l
    SET sku_id = m.sku_id, status = 'mapped', updated_at = NOW()
    FROM (
      SELECT l2.id, COALESCE(a.sku_id, s.id, w.id) AS sku_id
      FROM tri_import_lines l2
      LEFT JOIN tri_sku_aliases a
        ON a.source = ${source}
        AND a.programme_id = ${programmeId}
        AND a.normalized_code = l2.normalized_code
      LEFT JOIN tri_skus s
        ON s.programme_id = ${programmeId}
        AND s.w_code IS NOT NULL
        AND UPPER(REGEXP_REPLACE(s.w_code, '[^A-Za-z0-9]', '', 'g')) = l2.normalized_code
      LEFT JOIN LATERAL (
        SELECT s2.id FROM tri_skus s2
        WHERE s2.programme_id = ${programmeId}
          AND s2.lwin18 IS NOT NULL
          AND UPPER(REGEXP_REPLACE(s2.lwin18, '[^A-Za-z0-9]', '', 'g'))
              = l2.normalized_code
        -- Ordered, because a LIMIT without one lets the plan decide which
        -- duplicate wins. The same line then maps to a different SKU between
        -- runs, which reads as figures moving on their own.
        ORDER BY s2.id
        LIMIT 1
      ) w ON TRUE
      WHERE l2.import_id = ${importId}
        AND l2.status <> 'ignored'
        AND l2.normalized_code IS NOT NULL
        AND l2.normalized_code <> ''
    ) m
    WHERE l.id = m.id AND m.sku_id IS NOT NULL
  `;

  // A code set aside once stays set aside — including when the same code
  // arrives in next month's file. Without this the decision would have to be
  // retaken every time a feed refreshed. Only this client's decisions count:
  // a code one client set aside can be another client's wine.
  await sql`
    UPDATE tri_import_lines l
    SET status = 'ignored', sku_id = NULL, updated_at = NOW()
    FROM (
      SELECT DISTINCT il.normalized_code
      FROM tri_import_lines il
      JOIN tri_imports ii ON ii.id = il.import_id
      WHERE il.status = 'ignored'
        AND COALESCE(il.normalized_code, '') <> ''
        AND ii.programme_id = ${programmeId}
    ) ignored
    WHERE l.import_id = ${importId}
      AND l.normalized_code = ignored.normalized_code
      AND l.status <> 'ignored'
  `;

  // Case-denominated lines that did not state a pack size inherit it from the
  // SKU now that we know which SKU they are.
  await recalculateLineBottles(importId, sql);

  const [totals] = await sql<
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

  await sql`
    UPDATE tri_imports
    SET row_count = ${rowCount},
        mapped_row_count = ${mappedRowCount},
        total_bottles = ${totalBottles},
        updated_at = NOW()
    WHERE id = ${importId}
  `;

  return { rowCount, mappedRowCount, totalBottles, locked: false };
};

export default mapImportLines;
