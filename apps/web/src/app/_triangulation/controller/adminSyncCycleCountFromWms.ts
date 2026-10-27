import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import resolveWmsOwner from '../data/resolveWmsOwner';
import swapFeedImport from '../data/swapFeedImport';
import { syncCountFromWmsSchema } from '../schemas/triangulationSchemas';
import normalizeCode from '../utils/normalizeCode';
import resolveProgrammeId from '../utils/programmeId';
import tokenizeMatch from '../utils/tokenizeMatch';

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
    const programmeId = resolveProgrammeId(input.programmeId);
    const { periodId } = input;
    // The programme's configured owner, not whatever the browser sent
    const ownerName = await resolveWmsOwner(programmeId, input.ownerName);
    const upTo = input.asOfDate ?? new Date().toISOString().slice(0, 10);

    const tokens = tokenizeMatch(ownerName);

    if (tokens.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Owner name must contain at least one letter or number',
      });
    }

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

    // A cycle count covers a location, not an owner, so it will include other
    // owners' wine. The count line's stock record is what attributes it — a
    // line with no stock link cannot be attributed and is reported rather than
    // guessed at, since counting someone else's bottles as Crurated's would
    // manufacture a variance out of nothing.
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
      JOIN wms_stock st ON st.id = ci.stock_id
      WHERE c.status = 'completed'
        AND c.completed_at::date = ${countDate}
        AND ci.counted_quantity IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM UNNEST(${tokens}::text[]) AS t(tok)
          -- Whole words only: "CRU" must not match "CRURATED"
          WHERE NOT (tok = ANY(REGEXP_SPLIT_TO_ARRAY(UPPER(COALESCE(st.owner_name, '')), '[^A-Z0-9]+')))
        )
      GROUP BY ci.lwin18
      HAVING SUM(ci.counted_quantity) > 0
    `;

    const [unattributed] = await client<{ lines: number }[]>`
      SELECT COUNT(*)::int AS lines
      FROM wms_cycle_count_items ci
      JOIN wms_cycle_counts c ON c.id = ci.cycle_count_id
      WHERE c.status = 'completed'
        AND c.completed_at::date = ${countDate}
        AND ci.counted_quantity IS NOT NULL
        AND ci.stock_id IS NULL
    `;

    if (rows.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message:
          `The cycle count completed on ${countDate} recorded nothing for an owner containing all of: ${tokens.join(', ')}.` +
          ((unattributed?.lines ?? 0) > 0
            ? ` ${unattributed?.lines} counted lines have no stock record, so their owner could not be determined.`
            : ''),
      });
    }

    const { importId, totals } = await swapFeedImport({
      programmeId,
      replaces: {
        kind: 'cc_count',
        sourceRefs: ['wms-cycle-count'],
        asOfDate: countDate,
      },
      create: {
        periodId: periodId ?? null,
        kind: 'cc_count',
        fileName: `WMS cycle count — ${countDate}`,
        sourceRef: 'wms-cycle-count',
        aliasSource: 'crurated',
        asOfDate: countDate,
        notes:
          'Physical count synced from the WMS cycle count. Counted cases converted at each LWIN pack size.',
        uploadedBy: ctx.user.id,
      },
      columns: [
        'raw_code',
        'normalized_code',
        'raw_description',
        'quantity',
        'unit',
        'case_config',
        'quantity_bottles',
        'status',
      ],
      rows: rows.map((row) => ({
        raw_code: row.lwin18,
        normalized_code: normalizeCode(row.lwin18),
        raw_description: row.productName,
        quantity: row.countedCases,
        unit: 'case',
        case_config: row.caseConfig,
        quantity_bottles: row.bottles,
        status: 'unmapped',
      })),
    });

    return {
      importId,
      asOfDate: countDate,
      ...totals,
      missingCaseConfig: rows.filter((row) => !row.caseConfig).length,
      unattributedLines: unattributed?.lines ?? 0,
    };
  });

export default adminSyncCycleCountFromWms;
