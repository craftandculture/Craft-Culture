import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getTriangulationSchema } from '../schemas/triangulationSchemas';

export interface TriangulationRow {
  skuId: string;
  wCode: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
  caseConfig: number;
  cdCodes: string | null;
  /** Bottles C&C has taken in for this SKU, cumulative to the cut-off */
  ccReceived: number;
  /** Bottles C&C has invoiced to City Drinks, cumulative to the cut-off */
  ccSoldToCd: number;
  /** received − sold to CD */
  ccOnHandCalc: number;
  /** The same calculation re-cut to the physical count date */
  ccOnHandCalcAtCount: number | null;
  ccCounted: number | null;
  ccVariance: number | null;
  /** What City Drinks received is what we invoiced them */
  cdReceived: number;
  cdSold: number;
  /** received − sold through */
  cdOnHandCalc: number;
  cdOnHandCalcAtCount: number | null;
  cdDeclared: number | null;
  cdVariance: number | null;
  /** Calculated position is negative, i.e. more went out than ever came in */
  hasNegative: boolean;
}

export interface TriangulationSummary {
  ccReceived: number;
  ccSoldToCd: number;
  ccOnHandCalc: number;
  cdSold: number;
  cdOnHandCalc: number;
  ccVarianceAbs: number;
  cdVarianceAbs: number;
  negativeRows: number;
  skuCount: number;
}

/**
 * The triangulation itself: every W code reconciled across both parties
 *
 * Two chains are calculated from the flow inputs, both in bottles:
 *
 *     C&C on hand  = received into C&C − invoiced to City Drinks
 *     CD on hand   = invoiced to City Drinks − sold to consumers
 *
 * Each is then checked against the corresponding physical count. Counts are a
 * snapshot, so the comparison is re-cut to the count date rather than the
 * period end — comparing a June count against an August calculation would
 * report every July movement as a variance.
 *
 * Only committed imports and mapped lines contribute; unmapped lines are
 * reported separately so nobody reads a clean variance off an incomplete map.
 */
const adminGetTriangulation = adminProcedure
  .input(getTriangulationSchema)
  .query(async ({ input }) => {
    const { periodId, search, variancesOnly } = input;

    const [period] = periodId
      ? await client<{ label: string; periodEnd: string }[]>`
          SELECT label, period_end::text AS "periodEnd"
          FROM tri_periods WHERE id = ${periodId} LIMIT 1
        `
      : [];

    // With no period selected, reconcile everything recorded to date.
    const cutoff = period?.periodEnd ?? '9999-12-31';

    const [countDates] = await client<
      { ccCountDate: string | null; cdCountDate: string | null }[]
    >`
      SELECT
        (
          SELECT MAX(as_of_date)::text FROM tri_imports
          WHERE kind = 'cc_count' AND status = 'committed' AND as_of_date <= ${cutoff}
        ) AS "ccCountDate",
        (
          SELECT MAX(as_of_date)::text FROM tri_imports
          WHERE kind = 'cd_count' AND status = 'committed' AND as_of_date <= ${cutoff}
        ) AS "cdCountDate"
    `;

    const ccCountDate = countDates?.ccCountDate ?? null;
    const cdCountDate = countDates?.cdCountDate ?? null;

    const term = search?.trim() ? `%${search.trim()}%` : null;

    const rows = await client<TriangulationRow[]>`
      WITH flows AS (
        SELECT
          l.sku_id,
          SUM(CASE WHEN i.kind = 'cc_opening' THEN l.quantity_bottles ELSE 0 END)
            AS cc_received,
          SUM(CASE WHEN i.kind = 'cc_sales_to_cd' THEN l.quantity_bottles ELSE 0 END)
            AS cc_sold_to_cd,
          SUM(CASE WHEN i.kind = 'cd_sales' THEN l.quantity_bottles ELSE 0 END)
            AS cd_sold,
          SUM(CASE WHEN i.kind = 'cc_opening' AND i.as_of_date <= ${ccCountDate}
              THEN l.quantity_bottles ELSE 0 END) AS cc_received_at_count,
          SUM(CASE WHEN i.kind = 'cc_sales_to_cd' AND i.as_of_date <= ${ccCountDate}
              THEN l.quantity_bottles ELSE 0 END) AS cc_sold_at_count,
          SUM(CASE WHEN i.kind = 'cc_sales_to_cd' AND i.as_of_date <= ${cdCountDate}
              THEN l.quantity_bottles ELSE 0 END) AS cd_received_at_count,
          SUM(CASE WHEN i.kind = 'cd_sales' AND i.as_of_date <= ${cdCountDate}
              THEN l.quantity_bottles ELSE 0 END) AS cd_sold_at_count
        FROM tri_import_lines l
        JOIN tri_imports i ON i.id = l.import_id
        WHERE i.status = 'committed'
          AND l.sku_id IS NOT NULL
          AND i.kind IN ('cc_opening', 'cc_sales_to_cd', 'cd_sales')
          AND i.as_of_date <= ${cutoff}
        GROUP BY l.sku_id
      ),
      cc_counts AS (
        SELECT l.sku_id, SUM(l.quantity_bottles) AS qty
        FROM tri_import_lines l
        JOIN tri_imports i ON i.id = l.import_id
        WHERE i.kind = 'cc_count'
          AND i.status = 'committed'
          AND i.as_of_date = ${ccCountDate}
          AND l.sku_id IS NOT NULL
        GROUP BY l.sku_id
      ),
      cd_counts AS (
        SELECT l.sku_id, SUM(l.quantity_bottles) AS qty
        FROM tri_import_lines l
        JOIN tri_imports i ON i.id = l.import_id
        WHERE i.kind = 'cd_count'
          AND i.status = 'committed'
          AND i.as_of_date = ${cdCountDate}
          AND l.sku_id IS NOT NULL
        GROUP BY l.sku_id
      ),
      combined AS (
        SELECT
          s.id AS "skuId",
          s.w_code AS "wCode",
          s.product_name AS "productName",
          s.producer,
          s.vintage,
          s.case_config AS "caseConfig",
          (
            SELECT STRING_AGG(a.alias_code, ', ' ORDER BY a.alias_code)
            FROM tri_sku_aliases a
            WHERE a.sku_id = s.id AND a.source = 'city_drinks'
          ) AS "cdCodes",
          COALESCE(f.cc_received, 0)::float8 AS "ccReceived",
          COALESCE(f.cc_sold_to_cd, 0)::float8 AS "ccSoldToCd",
          (COALESCE(f.cc_received, 0) - COALESCE(f.cc_sold_to_cd, 0))::float8
            AS "ccOnHandCalc",
          CASE WHEN ${ccCountDate}::date IS NULL THEN NULL ELSE
            (COALESCE(f.cc_received_at_count, 0) - COALESCE(f.cc_sold_at_count, 0))::float8
          END AS "ccOnHandCalcAtCount",
          cc.qty::float8 AS "ccCounted",
          CASE WHEN cc.qty IS NULL THEN NULL ELSE
            (cc.qty - (COALESCE(f.cc_received_at_count, 0) - COALESCE(f.cc_sold_at_count, 0)))::float8
          END AS "ccVariance",
          COALESCE(f.cc_sold_to_cd, 0)::float8 AS "cdReceived",
          COALESCE(f.cd_sold, 0)::float8 AS "cdSold",
          (COALESCE(f.cc_sold_to_cd, 0) - COALESCE(f.cd_sold, 0))::float8
            AS "cdOnHandCalc",
          CASE WHEN ${cdCountDate}::date IS NULL THEN NULL ELSE
            (COALESCE(f.cd_received_at_count, 0) - COALESCE(f.cd_sold_at_count, 0))::float8
          END AS "cdOnHandCalcAtCount",
          cd.qty::float8 AS "cdDeclared",
          CASE WHEN cd.qty IS NULL THEN NULL ELSE
            (cd.qty - (COALESCE(f.cd_received_at_count, 0) - COALESCE(f.cd_sold_at_count, 0)))::float8
          END AS "cdVariance",
          (
            COALESCE(f.cc_received, 0) - COALESCE(f.cc_sold_to_cd, 0) < 0
            OR COALESCE(f.cc_sold_to_cd, 0) - COALESCE(f.cd_sold, 0) < 0
          ) AS "hasNegative"
        FROM tri_skus s
        LEFT JOIN flows f ON f.sku_id = s.id
        LEFT JOIN cc_counts cc ON cc.sku_id = s.id
        LEFT JOIN cd_counts cd ON cd.sku_id = s.id
        WHERE (f.sku_id IS NOT NULL OR cc.sku_id IS NOT NULL OR cd.sku_id IS NOT NULL)
          ${
            term
              ? client`AND (
                  s.w_code ILIKE ${term}
                  OR s.product_name ILIKE ${term}
                  OR s.producer ILIKE ${term}
                  OR EXISTS (
                    SELECT 1 FROM tri_sku_aliases a2
                    WHERE a2.sku_id = s.id AND a2.alias_code ILIKE ${term}
                  )
                )`
              : client``
          }
      )
      SELECT * FROM combined
      ${
        variancesOnly
          ? client`WHERE COALESCE("ccVariance", 0) <> 0
              OR COALESCE("cdVariance", 0) <> 0
              OR "hasNegative"`
          : client``
      }
      ORDER BY
        GREATEST(ABS(COALESCE("ccVariance", 0)), ABS(COALESCE("cdVariance", 0))) DESC,
        "productName",
        "vintage"
    `;

    const summary = rows.reduce<TriangulationSummary>(
      (accumulator, row) => ({
        ccReceived: accumulator.ccReceived + row.ccReceived,
        ccSoldToCd: accumulator.ccSoldToCd + row.ccSoldToCd,
        ccOnHandCalc: accumulator.ccOnHandCalc + row.ccOnHandCalc,
        cdSold: accumulator.cdSold + row.cdSold,
        cdOnHandCalc: accumulator.cdOnHandCalc + row.cdOnHandCalc,
        ccVarianceAbs: accumulator.ccVarianceAbs + Math.abs(row.ccVariance ?? 0),
        cdVarianceAbs: accumulator.cdVarianceAbs + Math.abs(row.cdVariance ?? 0),
        negativeRows: accumulator.negativeRows + (row.hasNegative ? 1 : 0),
        skuCount: accumulator.skuCount + 1,
      }),
      {
        ccReceived: 0,
        ccSoldToCd: 0,
        ccOnHandCalc: 0,
        cdSold: 0,
        cdOnHandCalc: 0,
        ccVarianceAbs: 0,
        cdVarianceAbs: 0,
        negativeRows: 0,
        skuCount: 0,
      },
    );

    const [dataQuality] = await client<
      {
        unmappedLines: number;
        unmappedCodes: number;
        draftImports: number;
        presentKinds: string[];
      }[]
    >`
      SELECT
        COUNT(l.id) FILTER (WHERE l.status = 'unmapped')::int AS "unmappedLines",
        COUNT(DISTINCT l.normalized_code) FILTER (WHERE l.status = 'unmapped')::int
          AS "unmappedCodes",
        COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'draft')::int AS "draftImports",
        COALESCE(
          ARRAY_AGG(DISTINCT i.kind::text) FILTER (WHERE i.status = 'committed'),
          ARRAY[]::text[]
        ) AS "presentKinds"
      FROM tri_imports i
      LEFT JOIN tri_import_lines l ON l.import_id = i.id
      WHERE i.as_of_date <= ${cutoff}
    `;

    return {
      rows,
      summary,
      meta: {
        periodLabel: period?.label ?? 'All time',
        cutoff: period?.periodEnd ?? null,
        ccCountDate,
        cdCountDate,
        unmappedLines: dataQuality?.unmappedLines ?? 0,
        unmappedCodes: dataQuality?.unmappedCodes ?? 0,
        draftImports: dataQuality?.draftImports ?? 0,
        presentKinds: dataQuality?.presentKinds ?? [],
      },
    };
  });

export default adminGetTriangulation;
