import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import { updateImportSchema } from '../schemas/triangulationSchemas';
import type { TriAliasSource } from '../schemas/triangulationSchemas';

/**
 * Correct an import that was uploaded with the wrong settings
 *
 * The costly mistake is the unit: a file read as bottles when it was really
 * cases understates that input six-fold, and it is usually only spotted once
 * the reconciliation looks wrong. Re-uploading would throw away the code
 * mappings already resolved against it, so the fix is applied in place —
 * quantities are reinterpreted, bottles recomputed and the lines re-mapped.
 *
 * Committed imports can be corrected too, since that is when the error tends
 * to surface. Only a locked period refuses.
 */
const adminUpdateImport = adminProcedure
  .input(updateImportSchema)
  .mutation(async ({ input }) => {
    const {
      importId,
      kind,
      periodId,
      asOfDate,
      aliasSource,
      notes,
      unit,
      caseConfigOverride,
    } = input;

    const [record] = await client<
      { aliasSource: TriAliasSource; periodStatus: string | null }[]
    >`
      SELECT i.alias_source AS "aliasSource", p.status AS "periodStatus"
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
        message: 'This period is locked. Reopen it before editing imports.',
      });
    }

    if (periodId) {
      const [target] = await client<{ status: string }[]>`
        SELECT status FROM tri_periods WHERE id = ${periodId} LIMIT 1
      `;

      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Period not found' });
      }

      if (target.status === 'locked') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'That period is locked. Reopen it before moving imports into it.',
        });
      }
    }

    // `periodId` and `notes` are nullable in their own right — undefined means
    // "leave alone" while null means "clear" — so they cannot be folded into a
    // COALESCE with the others.
    await client`
      UPDATE tri_imports
      SET kind = COALESCE(${kind ?? null}, kind),
          as_of_date = COALESCE(${asOfDate ?? null}, as_of_date),
          alias_source = COALESCE(${aliasSource ?? null}, alias_source),
          updated_at = NOW()
      WHERE id = ${importId}
    `;

    if (periodId !== undefined) {
      await client`
        UPDATE tri_imports SET period_id = ${periodId}, updated_at = NOW()
        WHERE id = ${importId}
      `;
    }

    if (notes !== undefined) {
      await client`
        UPDATE tri_imports SET notes = ${notes}, updated_at = NOW()
        WHERE id = ${importId}
      `;
    }

    if (unit) {
      await client`
        UPDATE tri_import_lines
        SET unit = ${unit}, updated_at = NOW()
        WHERE import_id = ${importId}
      `;
    }

    if (caseConfigOverride !== undefined) {
      await client`
        UPDATE tri_import_lines
        SET case_config = ${caseConfigOverride}, updated_at = NOW()
        WHERE import_id = ${importId}
      `;
    }

    // Re-mapping recomputes the bottle figures and the import's totals, so it
    // runs whatever changed — a moved period alone leaves them correct, but
    // running it unconditionally keeps one path to worry about.
    const totals = await mapImportLines(importId, aliasSource ?? record.aliasSource);

    return { importId, ...totals };
  });

export default adminUpdateImport;
