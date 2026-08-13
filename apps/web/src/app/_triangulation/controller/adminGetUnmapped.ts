import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import backfillDescriptionKeys from '../data/backfillDescriptionKeys';
import { getUnmappedSchema } from '../schemas/triangulationSchemas';
import type { TriImportKind } from '../schemas/triangulationSchemas';

export interface TriUnmappedRow {
  normalizedCode: string;
  rawCode: string | null;
  rawDescription: string | null;
  rawVintage: string | null;
  aliasSource: string;
  kinds: TriImportKind[];
  lineCount: number;
  totalQuantity: number;
  /** Best-guess W code SKUs, ranked by description similarity */
  suggestions: { id: string; wCode: string; productName: string; vintage: number | null; score: number }[];
}

/**
 * Group every unmapped import line by its raw code, with suggested matches
 *
 * This is the queue that has to be emptied before a reconciliation can be
 * trusted: each row here is stock movement the triangulation cannot attribute
 * to a product. Suggestions use trigram similarity on the description, the
 * same approach the Zoho importer uses for LWIN matching.
 */
const adminGetUnmapped = adminProcedure
  .input(getUnmappedSchema)
  .query(async ({ input }) => {
    const { importId, includeIgnored, limit } = input;

    // A write inside a read, deliberately: until every line has a key, this
    // queue shows unrelated wines merged into one group, and mapping that
    // group would assign them all to one SKU. The repair only fills missing
    // keys, so it matches nothing once the data is sound.
    await backfillDescriptionKeys(importId ?? undefined);

    const rows = await client<TriUnmappedRow[]>`
      WITH unmapped AS (
        SELECT
          l.normalized_code,
          MIN(l.raw_code) AS raw_code,
          MIN(l.raw_description) AS raw_description,
          MIN(l.raw_vintage) AS raw_vintage,
          MIN(i.alias_source) AS alias_source,
          ARRAY_AGG(DISTINCT i.kind::text) AS kinds,
          COUNT(*)::int AS line_count,
          COALESCE(SUM(l.quantity_bottles), 0)::float8 AS total_quantity
        FROM tri_import_lines l
        JOIN tri_imports i ON i.id = l.import_id
        WHERE l.status = ${includeIgnored ? 'ignored' : 'unmapped'}
          ${importId ? client`AND l.import_id = ${importId}` : client``}
        GROUP BY l.normalized_code
      )
      SELECT
        u.normalized_code AS "normalizedCode",
        u.raw_code AS "rawCode",
        u.raw_description AS "rawDescription",
        u.raw_vintage AS "rawVintage",
        u.alias_source AS "aliasSource",
        u.kinds,
        u.line_count AS "lineCount",
        u.total_quantity AS "totalQuantity",
        COALESCE(
          (
            SELECT JSON_AGG(x ORDER BY x.score DESC)
            FROM (
              SELECT
                s.id,
                s.w_code AS "wCode",
                s.product_name AS "productName",
                s.vintage,
                similarity(s.product_name, COALESCE(u.raw_description, '')) AS score
              FROM tri_skus s
              WHERE u.raw_description IS NOT NULL
                AND similarity(s.product_name, u.raw_description) > 0.25
              ORDER BY score DESC
              LIMIT 5
            ) x
          ),
          '[]'::json
        ) AS suggestions
      FROM unmapped u
      ORDER BY u.total_quantity DESC
      LIMIT ${limit}
    `;

    return rows;
  });

export default adminGetUnmapped;
