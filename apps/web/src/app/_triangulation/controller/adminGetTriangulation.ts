import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getTriangulationSchema } from '../schemas/triangulationSchemas';
import resolveProgrammeId from '../utils/programmeId';


export interface TriangulationRow {
  skuId: string;
  wCode: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
  caseConfig: number;
  bottleSize: string | null;
  cdCodes: string | null;
  /** Bottles C&C has taken in for this SKU, cumulative to the cut-off */
  ccReceived: number;
  /** Bottles C&C has invoiced to City Drinks, cumulative to the cut-off */
  ccSoldToCd: number;
  /** received − sold to CD */
  ccOnHandCalc: number;
  /** The same calculation re-cut to the physical count date */
  ccOnHandCalcAtCount: number | null;
  /** Bottles physically found — a cycle count or an uploaded count sheet */
  ccCounted: number | null;
  ccVariance: number | null;
  /** Bottles the WMS believes it holds, live from wms_stock */
  ccSystem: number | null;
  /** System position less the calculated one, at the system snapshot date */
  ccSystemVariance: number | null;
  /** Counted less system: the warehouse disagreeing with its own records */
  ccCountVsSystem: number | null;
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
  ccSystem: number;
  ccSystemVarianceAbs: number;
  ccCountVsSystemAbs: number;
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
    const programmeId = resolveProgrammeId(input.programmeId);

    const [period] = periodId
      ? await client<{ label: string; periodEnd: string; status: string }[]>`
          SELECT label, period_end::text AS "periodEnd", status
          FROM tri_periods
           WHERE id = ${periodId} AND programme_id = ${programmeId}
           LIMIT 1
        `
      : [];

    // With no period selected, reconcile everything recorded to date.
    const cutoff = period?.periodEnd ?? '9999-12-31';

    /**
     * Which snapshot to fall back on when none was taken by the cut-off.
     *
     * The WMS can only be read *now*, so a period that ended before today has
     * nothing on or before its cut-off and has to reach past it. Which way it
     * reaches is the whole question.
     *
     * A locked period is a signed-off answer, so it wants the reading nearest
     * its own end — the earliest one after it — and must not drift as more
     * snapshots are taken.
     *
     * An open period is the one being worked, and there the earliest reading
     * after the cut-off is a trap: MIN never advances, so the column pins
     * itself to the first snapshot ever taken and every later sync is ignored.
     * That is how a fresh count of 126 bottles kept reporting the 90 it held
     * five days earlier, and why the variance looked like missing stock.
     */
    const isOpen = !period || period.status !== 'locked';

    // Two different things arrive as a C&C snapshot and they must not be mixed.
    // `wms-stock` is what the system believes it holds; a cycle count or an
    // uploaded sheet is what someone physically found on the shelf. Comparing
    // the calculation against each separately is what makes the difference
    // between "picking and invoicing disagree" and "the warehouse and the
    // system disagree" legible.
    // A snapshot is dated when it was taken, and the WMS is only ever read
    // *now* — so on any period that closed before today there is nothing on or
    // before the cut-off to find, and both snapshot columns come back empty.
    // Falling back to the earliest snapshot after the cut-off keeps the columns
    // useful, and stays honest because each comparison is re-cut to its own
    // snapshot date; the header and the banner say which date was used.
    const [countDates] = await client<
      {
        ccSystemDate: string | null;
        ccCountDate: string | null;
        cdCountDate: string | null;
      }[]
    >`
      SELECT
        COALESCE(
          (
            SELECT MAX(as_of_date)::text FROM tri_imports
            WHERE kind = 'cc_count' AND status = 'committed'
              AND programme_id = ${programmeId}
              AND source_ref IN ('wms-stock', 'wms-sync')
              AND as_of_date <= ${cutoff}
          ),
          (
            SELECT ${isOpen ? client`MAX(as_of_date)` : client`MIN(as_of_date)`}::text FROM tri_imports
            WHERE kind = 'cc_count' AND status = 'committed'
              AND programme_id = ${programmeId}
              AND source_ref IN ('wms-stock', 'wms-sync')
          )
        ) AS "ccSystemDate",
        COALESCE(
          (
            SELECT MAX(as_of_date)::text FROM tri_imports
            WHERE kind = 'cc_count' AND status = 'committed'
              AND programme_id = ${programmeId}
              AND (source_ref IS NULL OR source_ref NOT IN ('wms-stock', 'wms-sync'))
              AND as_of_date <= ${cutoff}
          ),
          (
            SELECT ${isOpen ? client`MAX(as_of_date)` : client`MIN(as_of_date)`}::text FROM tri_imports
            WHERE kind = 'cc_count' AND status = 'committed'
              AND programme_id = ${programmeId}
              AND (source_ref IS NULL OR source_ref NOT IN ('wms-stock', 'wms-sync'))
          )
        ) AS "ccCountDate",
        (
          SELECT MAX(as_of_date)::text FROM tri_imports
          WHERE kind = 'cd_count' AND status = 'committed'
            AND programme_id = ${programmeId} AND as_of_date <= ${cutoff}
        ) AS "cdCountDate"
    `;

    const ccSystemDate = countDates?.ccSystemDate ?? null;
    const ccCountDate = countDates?.ccCountDate ?? null;
    const cdCountDate = countDates?.cdCountDate ?? null;

    const term = search?.trim() ? `%${search.trim()}%` : null;

    const rows = await client<TriangulationRow[]>`
      WITH flow_lines AS (
        -- A flow line counts from its own document date when the source gave
        -- one. The live feeds file all of history as a single import, so
        -- cutting by the import's date would put every movement in whichever
        -- period the feed last refreshed. Uploads without a date column fall
        -- back to the import date as before.
        SELECT
          l.sku_id,
          i.kind,
          l.quantity_bottles,
          COALESCE(l.doc_date, i.as_of_date) AS effective_date
        FROM tri_import_lines l
        JOIN tri_imports i ON i.id = l.import_id
        WHERE i.status = 'committed'
          AND i.programme_id = ${programmeId}
          AND l.sku_id IS NOT NULL
          AND i.kind IN ('cc_opening', 'cc_sales_to_cd', 'cd_sales')
      ),
      flows AS (
        SELECT
          sku_id,
          SUM(CASE WHEN kind = 'cc_opening' THEN quantity_bottles ELSE 0 END)
            AS cc_received,
          SUM(CASE WHEN kind = 'cc_sales_to_cd' THEN quantity_bottles ELSE 0 END)
            AS cc_sold_to_cd,
          SUM(CASE WHEN kind = 'cd_sales' THEN quantity_bottles ELSE 0 END)
            AS cd_sold,
          SUM(CASE WHEN kind = 'cc_opening' AND effective_date <= ${ccCountDate}
              THEN quantity_bottles ELSE 0 END) AS cc_received_at_count,
          SUM(CASE WHEN kind = 'cc_sales_to_cd' AND effective_date <= ${ccCountDate}
              THEN quantity_bottles ELSE 0 END) AS cc_sold_at_count,
          SUM(CASE WHEN kind = 'cc_opening' AND effective_date <= ${ccSystemDate}
              THEN quantity_bottles ELSE 0 END) AS cc_received_at_system,
          SUM(CASE WHEN kind = 'cc_sales_to_cd' AND effective_date <= ${ccSystemDate}
              THEN quantity_bottles ELSE 0 END) AS cc_sold_at_system,
          SUM(CASE WHEN kind = 'cc_sales_to_cd' AND effective_date <= ${cdCountDate}
              THEN quantity_bottles ELSE 0 END) AS cd_received_at_count,
          SUM(CASE WHEN kind = 'cd_sales' AND effective_date <= ${cdCountDate}
              THEN quantity_bottles ELSE 0 END) AS cd_sold_at_count
        FROM flow_lines
        WHERE effective_date <= ${cutoff}
        GROUP BY sku_id
      ),
      cc_counts AS (
        SELECT l.sku_id, SUM(l.quantity_bottles) AS qty
        FROM tri_import_lines l
        JOIN tri_imports i ON i.id = l.import_id
        WHERE i.kind = 'cc_count'
          AND i.status = 'committed'
          AND i.programme_id = ${programmeId}
          AND (i.source_ref IS NULL OR i.source_ref NOT IN ('wms-stock', 'wms-sync'))
          AND i.as_of_date = ${ccCountDate}
          AND l.sku_id IS NOT NULL
        GROUP BY l.sku_id
      ),
      cc_system AS (
        SELECT l.sku_id, SUM(l.quantity_bottles) AS qty
        FROM tri_import_lines l
        JOIN tri_imports i ON i.id = l.import_id
        WHERE i.kind = 'cc_count'
          AND i.status = 'committed'
          AND i.programme_id = ${programmeId}
          AND i.source_ref IN ('wms-stock', 'wms-sync')
          AND i.as_of_date = ${ccSystemDate}
          AND l.sku_id IS NOT NULL
        GROUP BY l.sku_id
      ),
      cd_counts AS (
        SELECT l.sku_id, SUM(l.quantity_bottles) AS qty
        FROM tri_import_lines l
        JOIN tri_imports i ON i.id = l.import_id
        WHERE i.kind = 'cd_count'
          AND i.status = 'committed'
          AND i.programme_id = ${programmeId}
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
          s.bottle_size AS "bottleSize",
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
          sys.qty::float8 AS "ccSystem",
          CASE WHEN sys.qty IS NULL THEN NULL ELSE
            (sys.qty - (COALESCE(f.cc_received_at_system, 0) - COALESCE(f.cc_sold_at_system, 0)))::float8
          END AS "ccSystemVariance",
          -- The warehouse against its own system: what was counted on the shelf
          -- versus what the WMS says is there.
          CASE WHEN cc.qty IS NULL OR sys.qty IS NULL THEN NULL ELSE
            (cc.qty - sys.qty)::float8
          END AS "ccCountVsSystem",
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
        LEFT JOIN cc_system sys ON sys.sku_id = s.id
        LEFT JOIN cd_counts cd ON cd.sku_id = s.id
        WHERE s.programme_id = ${programmeId}
          AND (
            f.sku_id IS NOT NULL OR cc.sku_id IS NOT NULL
            OR sys.sku_id IS NOT NULL OR cd.sku_id IS NOT NULL
          )
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
              OR COALESCE("ccSystemVariance", 0) <> 0
              OR COALESCE("ccCountVsSystem", 0) <> 0
              OR "hasNegative"`
          : client``
      }
      ORDER BY
        GREATEST(
          ABS(COALESCE("ccVariance", 0)),
          ABS(COALESCE("cdVariance", 0)),
          ABS(COALESCE("ccCountVsSystem", 0)),
          ABS(COALESCE("ccSystemVariance", 0))
        ) DESC,
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
        ccSystem: accumulator.ccSystem + (row.ccSystem ?? 0),
        ccSystemVarianceAbs:
          accumulator.ccSystemVarianceAbs + Math.abs(row.ccSystemVariance ?? 0),
        ccCountVsSystemAbs:
          accumulator.ccCountVsSystemAbs + Math.abs(row.ccCountVsSystem ?? 0),
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
        ccSystem: 0,
        ccSystemVarianceAbs: 0,
        ccCountVsSystemAbs: 0,
        negativeRows: 0,
        skuCount: 0,
      },
    );

    // An empty snapshot column has several very different causes — never
    // synced, synced but never committed, synced but every line unmapped — and
    // they are indistinguishable on screen. Count them so the banner can say
    // which one it is instead of leaving a bare dash.
    const [snapshotHealth] = await client<
      {
        systemImports: number;
        systemMappedLines: number;
        countImports: number;
        draftSnapshots: number;
      }[]
    >`
      SELECT
        COUNT(DISTINCT i.id) FILTER (
          WHERE i.status = 'committed'
          AND i.programme_id = ${programmeId}
            AND i.source_ref IN ('wms-stock', 'wms-sync')
        )::int AS "systemImports",
        COUNT(l.id) FILTER (
          WHERE i.status = 'committed'
          AND i.programme_id = ${programmeId}
            AND i.source_ref IN ('wms-stock', 'wms-sync')
            AND l.status = 'mapped'
        )::int AS "systemMappedLines",
        COUNT(DISTINCT i.id) FILTER (
          WHERE i.status = 'committed'
          AND i.programme_id = ${programmeId}
            AND (i.source_ref IS NULL OR i.source_ref NOT IN ('wms-stock', 'wms-sync'))
        )::int AS "countImports",
        COUNT(DISTINCT i.id) FILTER (
          WHERE i.status = 'draft'
          AND i.programme_id = ${programmeId}
        )::int AS "draftSnapshots"
      FROM tri_imports i
      LEFT JOIN tri_import_lines l ON l.import_id = i.id
      WHERE i.kind = 'cc_count'
        AND i.programme_id = ${programmeId}
    `;

    const [dataQuality] = await client<
      {
        unmappedLines: number;
        unmappedCodes: number;
        draftImports: number;
        presentKinds: string[];
      }[]
    >`
      -- Scoped by the same effective date the figures use. Filtering on the
      -- import's own date reported a live feed as "not yet received" while its
      -- lines were contributing to the totals on screen — the banner
      -- contradicting the number beside it.
      WITH scoped AS (
        SELECT
          i.id,
          i.kind,
          i.status,
          l.id AS line_id,
          l.status AS line_status,
          l.normalized_code,
          (CASE
            WHEN i.kind IN ('cc_opening', 'cc_sales_to_cd', 'cd_sales')
              THEN COALESCE(l.doc_date, i.as_of_date)
            ELSE i.as_of_date
          END) AS effective_date
        FROM tri_imports i
        LEFT JOIN tri_import_lines l ON l.import_id = i.id
        WHERE i.programme_id = ${programmeId}
      )
      SELECT
        COUNT(line_id) FILTER (WHERE line_status = 'unmapped')::int
          AS "unmappedLines",
        COUNT(DISTINCT normalized_code) FILTER (WHERE line_status = 'unmapped')::int
          AS "unmappedCodes",
        COUNT(DISTINCT id) FILTER (WHERE status = 'draft')::int AS "draftImports",
        COALESCE(
          ARRAY_AGG(DISTINCT kind::text) FILTER (WHERE status = 'committed'),
          ARRAY[]::text[]
        ) AS "presentKinds"
      FROM scoped
      WHERE effective_date <= ${cutoff}
    `;

    return {
      rows,
      summary,
      meta: {
        periodLabel: period?.label ?? 'All time',
        cutoff: period?.periodEnd ?? null,
        ccSystemDate,
        ccCountDate,
        cdCountDate,
        /** The snapshot used post-dates this period — shown, but say so */
        ccSystemOutsidePeriod:
          !!ccSystemDate && !!period?.periodEnd && ccSystemDate > period.periodEnd,
        ccCountOutsidePeriod:
          !!ccCountDate && !!period?.periodEnd && ccCountDate > period.periodEnd,
        systemImports: snapshotHealth?.systemImports ?? 0,
        systemMappedLines: snapshotHealth?.systemMappedLines ?? 0,
        countImports: snapshotHealth?.countImports ?? 0,
        draftSnapshots: snapshotHealth?.draftSnapshots ?? 0,
        unmappedLines: dataQuality?.unmappedLines ?? 0,
        unmappedCodes: dataQuality?.unmappedCodes ?? 0,
        draftImports: dataQuality?.draftImports ?? 0,
        presentKinds: dataQuality?.presentKinds ?? [],
      },
    };
  });

export default adminGetTriangulation;
