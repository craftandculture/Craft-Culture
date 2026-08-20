import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { CRURATED_PROGRAMME_ID, programmeIdSchema } from '../utils/programmeId';

export interface TriPeriodRow {
  id: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  status: 'open' | 'locked';
  notes: string | null;
  importCount: number;
  committedCount: number;
  unmappedLines: number;
}

/**
 * List every reporting period, newest first, with its input coverage
 *
 * `committedCount` and `unmappedLines` drive the data-quality banner — a
 * reconciliation read before all five inputs are in is misleading, so the UI
 * needs to say so up front.
 */
const adminGetPeriods = adminProcedure
  .input(z.object({ programmeId: programmeIdSchema }).optional())
  .query(async ({ input }) => {
    const programmeId = input?.programmeId ?? CRURATED_PROGRAMME_ID;

    const rows = await client<TriPeriodRow[]>`
    SELECT
      p.id,
      p.label,
      p.period_start::text AS "periodStart",
      p.period_end::text AS "periodEnd",
      p.status,
      p.notes,
      COALESCE(i.import_count, 0)::int AS "importCount",
      COALESCE(i.committed_count, 0)::int AS "committedCount",
      COALESCE(i.unmapped_lines, 0)::int AS "unmappedLines"
    FROM tri_periods p
    LEFT JOIN (
      SELECT
        imp.period_id,
        COUNT(DISTINCT imp.id) AS import_count,
        COUNT(DISTINCT imp.id) FILTER (WHERE imp.status = 'committed')
          AS committed_count,
        COUNT(l.id) FILTER (WHERE l.status = 'unmapped') AS unmapped_lines
      FROM tri_imports imp
      LEFT JOIN tri_import_lines l ON l.import_id = imp.id
      GROUP BY imp.period_id
    ) i ON i.period_id = p.id
    WHERE p.programme_id = ${programmeId}
    ORDER BY p.period_end DESC
  `;

    return rows;
  });

export default adminGetPeriods;
