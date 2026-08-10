import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import { importIdSchema } from '../schemas/triangulationSchemas';
import type { TriAliasSource } from '../schemas/triangulationSchemas';

/**
 * Commit a draft import so it feeds the reconciliation
 *
 * Mapping is re-run first, so aliases resolved since the upload are picked up.
 * Unmapped rows do not block the commit — they are excluded from the maths and
 * reported on the Mapping tab instead, because holding a whole month's file
 * hostage to one unknown code helps nobody.
 */
const adminCommitImport = adminProcedure
  .input(importIdSchema)
  .mutation(async ({ input }) => {
    const { importId } = input;

    const [record] = await client<
      { status: string; aliasSource: TriAliasSource; periodStatus: string | null }[]
    >`
      SELECT i.status, i.alias_source AS "aliasSource", p.status AS "periodStatus"
      FROM tri_imports i
      LEFT JOIN tri_periods p ON p.id = i.period_id
      WHERE i.id = ${importId}
      LIMIT 1
    `;

    if (!record) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Import not found' });
    }

    if (record.periodStatus === 'locked') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This period is locked. Reopen it before committing imports.',
      });
    }

    const totals = await mapImportLines(importId, record.aliasSource);

    await client`
      UPDATE tri_imports
      SET status = 'committed', committed_at = NOW(), updated_at = NOW()
      WHERE id = ${importId}
    `;

    return { importId, ...totals };
  });

export default adminCommitImport;
