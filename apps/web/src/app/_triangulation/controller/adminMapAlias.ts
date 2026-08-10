import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import { mapAliasSchema } from '../schemas/triangulationSchemas';

/**
 * Attach an external product code to a W code SKU
 *
 * This is the join that makes the City Drinks sales sheet reconcilable: their
 * CD code is recorded against our W code once, and every past and future line
 * carrying that code resolves automatically.
 *
 * With `applyToExistingLines`, imports that already contain the code are
 * re-mapped in place, so a month uploaded before the mapping existed does not
 * need re-uploading. Committed imports are re-mapped too — the alias corrects
 * data that was already feeding the reconciliation.
 */
const adminMapAlias = adminProcedure
  .input(mapAliasSchema)
  .mutation(async ({ input, ctx }) => {
    const { skuId, source, aliasCode, aliasName, applyToExistingLines } = input;

    const normalizedCode = aliasCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!normalizedCode) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Alias code must contain at least one letter or number',
      });
    }

    const [sku] = await client<{ id: string }[]>`
      SELECT id FROM tri_skus WHERE id = ${skuId} LIMIT 1
    `;

    if (!sku) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'SKU not found' });
    }

    await client`
      INSERT INTO tri_sku_aliases (
        sku_id, source, alias_code, normalized_code, alias_name, created_by
      )
      VALUES (
        ${skuId}, ${source}, ${aliasCode.trim()}, ${normalizedCode},
        ${aliasName ?? null}, ${ctx.user.id}
      )
      ON CONFLICT (source, normalized_code) DO UPDATE SET
        sku_id = ${skuId},
        alias_code = ${aliasCode.trim()},
        alias_name = ${aliasName ?? null},
        created_by = ${ctx.user.id},
        updated_at = NOW()
    `;

    if (!applyToExistingLines) {
      return { skuId, normalizedCode, remappedImports: 0 };
    }

    const affected = await client<{ id: string }[]>`
      SELECT DISTINCT i.id
      FROM tri_imports i
      JOIN tri_import_lines l ON l.import_id = i.id
      WHERE l.normalized_code = ${normalizedCode}
        AND i.alias_source = ${source}
    `;

    for (const record of affected) {
      await mapImportLines(record.id, source);
    }

    return { skuId, normalizedCode, remappedImports: affected.length };
  });

export default adminMapAlias;
