import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import findDuplicateLines from '../data/findDuplicateLines';
import mapImportLines from '../data/mapImportLines';
import { commitImportSchema } from '../schemas/triangulationSchemas';
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
  .input(commitImportSchema)
  .mutation(async ({ input }) => {
    const { importId, acknowledgeDuplicates } = input;

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

    // The same shipment reaches this tool by more than one route, and
    // committing both silently doubles the receipt — with figures that stay
    // plausible. Cheap to refuse here, expensive to unpick later.
    if (!acknowledgeDuplicates) {
      const duplicates = await findDuplicateLines(importId);

      if (duplicates.length > 0) {
        const bottles = duplicates.reduce(
          (sum, line) => sum + line.quantityBottles,
          0,
        );

        throw new TRPCError({
          code: 'CONFLICT',
          message:
            `${duplicates.length} line${duplicates.length === 1 ? '' : 's'} ` +
            `(${Math.round(bottles).toLocaleString('en-GB')} bottles) match stock already committed. ` +
            'Review them, then commit again to confirm they are genuinely separate.',
        });
      }
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
