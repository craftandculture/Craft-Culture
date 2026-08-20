import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import type { TriImportKind } from '../schemas/triangulationSchemas';
import resolveProgrammeId, { uuidLike } from '../utils/programmeId';


export interface TriImportRow {
  id: string;
  periodId: string | null;
  periodLabel: string | null;
  kind: TriImportKind;
  status: 'draft' | 'committed';
  fileName: string | null;
  sourceRef: string | null;
  aliasSource: string;
  asOfDate: string;
  rowCount: number;
  mappedRowCount: number;
  totalBottles: number;
  notes: string | null;
  uploadedByName: string | null;
  createdAt: Date;
  committedAt: Date | null;
  /** How the lines are denominated — 'bottle', 'case', or both if mixed */
  unit: string | null;
  /** Pack sizes present on the lines, joined when the file supplied several */
  caseConfig: string | null;
}

/**
 * List imports, newest first, optionally scoped to one period
 *
 * Passing no `periodId` returns every import — useful for opening stock, which
 * accumulates across periods rather than belonging to any single month.
 */
const adminGetImports = adminProcedure
  .input(
    z.object({
      programmeId: uuidLike.optional().nullable(),
      periodId: z.string().uuid().optional().nullable(),
      limit: z.number().int().positive().max(500).default(100),
    }),
  )
  .query(async ({ input }) => {
    const { periodId, limit } = input;
    const programmeId = resolveProgrammeId(input.programmeId);

    const rows = await client<TriImportRow[]>`
      SELECT
        i.id,
        i.period_id AS "periodId",
        p.label AS "periodLabel",
        i.kind,
        i.status,
        i.file_name AS "fileName",
        i.source_ref AS "sourceRef",
        i.alias_source AS "aliasSource",
        i.as_of_date::text AS "asOfDate",
        i.row_count AS "rowCount",
        i.mapped_row_count AS "mappedRowCount",
        i.total_bottles AS "totalBottles",
        i.notes,
        u.name AS "uploadedByName",
        i.created_at AS "createdAt",
        i.committed_at AS "committedAt",
        (
          SELECT STRING_AGG(DISTINCT l.unit, ' / ' ORDER BY l.unit)
          FROM tri_import_lines l WHERE l.import_id = i.id
        ) AS "unit",
        (
          SELECT STRING_AGG(DISTINCT l.case_config::text, ' / ' ORDER BY l.case_config::text)
          FROM tri_import_lines l
          WHERE l.import_id = i.id AND l.case_config IS NOT NULL
        ) AS "caseConfig"
      FROM tri_imports i
      LEFT JOIN tri_periods p ON p.id = i.period_id
      LEFT JOIN users u ON u.id = i.uploaded_by
      WHERE i.programme_id = ${programmeId}
      ${periodId ? client`AND i.period_id = ${periodId}` : client``}
      ORDER BY i.as_of_date DESC, i.created_at DESC
      LIMIT ${limit}
    `;

    return rows;
  });

export default adminGetImports;
