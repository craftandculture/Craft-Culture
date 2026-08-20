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

    // A whole file already committed under another name is a different claim
    // from a few colliding lines, and it needs refusing rather than warning.
    // City Drinks' sales sheet was uploaded twice — once dated to each month's
    // start, once to its end — and the per-line warning fired on every one of
    // the nine months, so it was acknowledged nine times and every bottle was
    // counted twice. A warning that appears that often is training, not a
    // guard, which is why this one has no acknowledgement.
    const [twin] = await client<
      { fileName: string | null; asOfDate: string }[]
    >`
      SELECT o.file_name AS "fileName", o.as_of_date::text AS "asOfDate"
      FROM tri_imports o
      JOIN tri_imports self ON self.id = ${importId}
      WHERE o.id <> self.id
        AND o.programme_id = self.programme_id
        AND o.kind = self.kind
        AND o.status = 'committed'
        AND o.row_count = self.row_count
        AND o.row_count > 0
        AND ABS(o.total_bottles - self.total_bottles) < 0.001
        AND o.total_bottles <> 0
      LIMIT 1
    `;

    if (twin) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          `This is already committed as "${twin.fileName ?? 'another import'}" ` +
          `(as at ${twin.asOfDate}) — same number of rows and the same bottle ` +
          `total. Committing it again would count every bottle twice. Delete ` +
          `one of them rather than acknowledging this.`,
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
