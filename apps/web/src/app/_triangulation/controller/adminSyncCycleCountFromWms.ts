import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import insertRows from '../data/insertRows';
import mapImportLines from '../data/mapImportLines';
import { syncCountFromWmsSchema } from '../schemas/triangulationSchemas';
import normalizeCode from '../utils/normalizeCode';

interface CycleCountRow {
  lwin18: string;
  productName: string;
  countedCases: number;
  caseConfig: number | null;
  bottles: number;
}

/**
 * Take the physical count from the WMS cycle counts
 *
 * This is the input that validates everything else. `wms_stock` only says what
 * the system believes; a cycle count says what someone actually found on the
 * shelf, which is the only thing that can catch the system being wrong.
 *
 * Counts are keyed by LWIN rather than by W code, so the lines resolve through
 * `tri_skus.lwin18` in the mapper rather than through the alias table.
 *
 * Only completed counts are taken, and the snapshot date is the date of the
 * most recent completed count on or before the requested date.
 */
const adminSyncCycleCountFromWms = adminProcedure
  .input(syncCountFromWmsSchema)
  .mutation(async ({ input, ctx }) => {
    const { periodId } = input;
    const upTo = input.asOfDate ?? new Date().toISOString().slice(0, 10);

    // A count can span several location-scoped runs finished on the same day,
    // so the snapshot is the whole of the latest day's completed counting.
    const [latest] = await client<{ countDate: string | null }[]>`
      SELECT MAX(completed_at)::date::text AS "countDate"
      FROM wms_cycle_counts
      WHERE status = 'completed'
        AND completed_at IS NOT NULL
        AND completed_at::date <= ${upTo}
    `;

    const countDate = latest?.countDate ?? null;

    if (!countDate) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message:
          'No completed cycle count found in the WMS. Run a count, or upload a count sheet instead.',
      });
    }

    const rows = await client<CycleCountRow[]>`
      SELECT
        ci.lwin18,
        MIN(ci.product_name) AS "productName",
        SUM(ci.counted_quantity)::float8 AS "countedCases",
        MAX(NULLIF(st.case_config, 0)) AS "caseConfig",
        SUM(ci.counted_quantity * COALESCE(NULLIF(st.case_config, 0), 6))::float8
          AS bottles
      FROM wms_cycle_count_items ci
      JOIN wms_cycle_counts c ON c.id = ci.cycle_count_id
      LEFT JOIN LATERAL (
        SELECT s.case_config FROM wms_stock s
        WHERE s.lwin18 = ci.lwin18
        ORDER BY s.received_at DESC NULLS LAST
        LIMIT 1
      ) st ON TRUE
      WHERE c.status = 'completed'
        AND c.completed_at::date = ${countDate}
        AND ci.counted_quantity IS NOT NULL
      GROUP BY ci.lwin18
      HAVING SUM(ci.counted_quantity) > 0
    `;

    if (rows.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `The cycle count completed on ${countDate} recorded no counted quantities.`,
      });
    }

    await client`
      DELETE FROM tri_imports
      WHERE kind = 'cc_count'
        AND source_ref = 'wms-cycle-count'
        AND as_of_date = ${countDate}
    `;

    const [created] = await client<{ id: string }[]>`
      INSERT INTO tri_imports (
        period_id, kind, status, file_name, source_ref, alias_source,
        as_of_date, notes, uploaded_by, committed_at
      )
      VALUES (
        ${periodId ?? null}, 'cc_count', 'committed',
        ${`WMS cycle count — ${countDate}`}, 'wms-cycle-count', 'crurated',
        ${countDate},
        ${'Physical count synced from the WMS cycle count. Counted cases converted at each LWIN pack size.'},
        ${ctx.user.id}, NOW()
      )
      RETURNING id
    `;

    const importId = created?.id;

    if (!importId) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create the cycle count snapshot',
      });
    }

    await insertRows(
      'tri_import_lines',
      [
        'import_id',
        'raw_code',
        'normalized_code',
        'raw_description',
        'quantity',
        'unit',
        'case_config',
        'quantity_bottles',
        'status',
      ],
      rows.map((row) => ({
        import_id: importId,
        raw_code: row.lwin18,
        normalized_code: normalizeCode(row.lwin18),
        raw_description: row.productName,
        quantity: row.countedCases,
        unit: 'case',
        case_config: row.caseConfig,
        quantity_bottles: row.bottles,
        status: 'unmapped',
      })),
    );

    const totals = await mapImportLines(importId, 'crurated');

    return {
      importId,
      asOfDate: countDate,
      ...totals,
      missingCaseConfig: rows.filter((row) => !row.caseConfig).length,
    };
  });

export default adminSyncCycleCountFromWms;
