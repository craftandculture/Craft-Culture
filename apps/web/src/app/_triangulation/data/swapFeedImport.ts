import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';

import insertRows from './insertRows';
import mapImportLines from './mapImportLines';
import type { TriAliasSource } from '../schemas/triangulationSchemas';

interface SwapFeedImportParams {
  programmeId: string;
  /** The previous run(s) this feed replaces */
  replaces: {
    kind: string;
    sourceRefs: string[];
    /** Only the run for this date, for dated snapshots */
    asOfDate?: string;
  };
  /** The new import */
  create: {
    periodId: string | null;
    kind: string;
    fileName: string;
    sourceRef: string;
    aliasSource: TriAliasSource;
    asOfDate: string;
    notes: string;
    uploadedBy: string;
  };
  columns: string[];
  /** Line rows without `import_id`; it is filled in here */
  rows: Record<string, unknown>[];
}

/**
 * Replace a synced feed with a freshly read one, all or nothing
 *
 * The data is read before this is called. Here the old run is deleted, the new
 * import and its lines are written and mapped, in one transaction: a failure
 * part-way leaves the previous figures in place rather than an empty feed. A
 * run sitting in a locked period is never replaced; the period was signed off
 * on it.
 *
 * @returns The new import's id and its mapping totals
 */
const swapFeedImport = async ({
  programmeId,
  replaces,
  create,
  columns,
  rows,
}: SwapFeedImportParams) => {
  const [frozen] = await client<{ id: string }[]>`
    SELECT i.id
    FROM tri_imports i
    JOIN tri_periods p ON p.id = i.period_id
    WHERE p.status = 'locked'
      AND i.programme_id = ${programmeId}
      AND i.kind = ${replaces.kind}
      AND i.source_ref = ANY(${replaces.sourceRefs}::text[])
      ${replaces.asOfDate ? client`AND i.as_of_date = ${replaces.asOfDate}` : client``}
    LIMIT 1
  `;

  if (frozen) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'The previous sync sits in a locked period. Reopen the period before syncing again.',
    });
  }

  if (create.periodId) {
    const [period] = await client<{ status: string }[]>`
      SELECT status FROM tri_periods WHERE id = ${create.periodId} LIMIT 1
    `;

    if (period?.status === 'locked') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This period is locked. Reopen it before syncing.',
      });
    }
  }

  return client.begin(async (sql) => {
    await sql`
      DELETE FROM tri_imports
      WHERE kind = ${replaces.kind}
        AND source_ref = ANY(${replaces.sourceRefs}::text[])
        AND programme_id = ${programmeId}
        ${replaces.asOfDate ? sql`AND as_of_date = ${replaces.asOfDate}` : sql``}
    `;

    const [created] = await sql<{ id: string }[]>`
      INSERT INTO tri_imports (
        programme_id, period_id, kind, status, file_name, source_ref, alias_source,
        as_of_date, notes, uploaded_by, committed_at
      )
      VALUES (
        ${programmeId}, ${create.periodId}, ${create.kind}, 'committed',
        ${create.fileName}, ${create.sourceRef}, ${create.aliasSource},
        ${create.asOfDate}, ${create.notes}, ${create.uploadedBy}, NOW()
      )
      RETURNING id
    `;

    const importId = created?.id;

    if (!importId) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create the synced import',
      });
    }

    await insertRows(
      'tri_import_lines',
      ['import_id', ...columns],
      rows.map((row) => ({ ...row, import_id: importId })),
      { sql },
    );

    const totals = await mapImportLines(importId, create.aliasSource, sql);

    return { importId, totals };
  });
};

export default swapFeedImport;
