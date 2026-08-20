import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import type { TriAliasSource } from '../schemas/triangulationSchemas';
import { uuidLike } from '../utils/programmeId';

/**
 * File an upload under the client it actually belongs to
 *
 * Uploads took the column default rather than the client on screen, so a batch
 * of one client's invoices landed under another. Deleting and re-uploading
 * would work, but only for someone who still has the files — and the fix for
 * misfiled data should not be losing it.
 *
 * The period is cleared on the way across. Periods belong to a client, so
 * carrying one over would leave the import attached to a month that belongs to
 * somebody else's calendar.
 *
 * The lines are re-mapped on arrival, since a code resolves against the
 * destination's registry and aliases, not the one it was filed under. Usually
 * that means everything lands unmapped, which is the honest state for a client
 * whose wines have not been created yet.
 */
const adminMoveImportToProgramme = adminProcedure
  .input(
    z.object({
      importIds: z.array(z.string().uuid()).min(1).max(200),
      programmeId: uuidLike,
    }),
  )
  .mutation(async ({ input }) => {
    const { importIds, programmeId } = input;

    const [programme] = await client<{ id: string; name: string }[]>`
      SELECT id, name FROM tri_programmes
      WHERE id = ${programmeId} AND is_active
      LIMIT 1
    `;

    if (!programme) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'That client no longer exists',
      });
    }

    const locked = await client<{ id: string }[]>`
      SELECT i.id
      FROM tri_imports i
      JOIN tri_periods p ON p.id = i.period_id
      WHERE i.id = ANY(${importIds}::uuid[]) AND p.status = 'locked'
    `;

    if (locked.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'One of these sits in a locked period. Reopen it before moving the import.',
      });
    }

    const moved = await client<{ id: string; aliasSource: string }[]>`
      UPDATE tri_imports
      SET programme_id = ${programmeId}, period_id = NULL, updated_at = NOW()
      WHERE id = ANY(${importIds}::uuid[])
      RETURNING id, alias_source AS "aliasSource"
    `;

    let mappedRowCount = 0;

    for (const row of moved) {
      const result = await mapImportLines(
        row.id,
        row.aliasSource as TriAliasSource,
      );

      mappedRowCount += result.mappedRowCount;
    }

    return {
      moved: moved.length,
      programmeName: programme.name,
      mappedRowCount,
    };
  });

export default adminMoveImportToProgramme;
