import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { importIdSchema } from '../schemas/triangulationSchemas';

/**
 * Delete an import and every line it brought in
 *
 * Used to replace a file that was uploaded with the wrong column mapping or
 * against the wrong period. Lines cascade, so the reconciliation drops the
 * contribution immediately.
 */
const adminDeleteImport = adminProcedure
  .input(importIdSchema)
  .mutation(async ({ input }) => {
    const { importId } = input;

    const [record] = await client<{ periodStatus: string | null }[]>`
      SELECT p.status AS "periodStatus"
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
        message: 'This period is locked. Reopen it before deleting imports.',
      });
    }

    await client`DELETE FROM tri_imports WHERE id = ${importId}`;

    return { importId };
  });

export default adminDeleteImport;
