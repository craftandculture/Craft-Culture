import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import { mergeSkusSchema } from '../schemas/triangulationSchemas';
import type { TriAliasSource } from '../schemas/triangulationSchemas';

/**
 * Fold one wine's duplicate SKU into the one that should have held it
 *
 * The same wine registered twice splits its own movement: part of it lands on
 * each W code, so one side reads short and the other looks unremarkable. Both
 * rows are individually consistent, which is why it reads as a stock variance
 * rather than as a naming problem.
 *
 * Until now the only way out was to delete the duplicate's alias, wait for the
 * code to fall back into the mapping queue, and map it again — three steps to
 * express one decision, with the figures wrong in between.
 *
 * Everything the duplicate carried moves across: its aliases, so the codes that
 * reached it keep resolving, and its lines, so history moves rather than being
 * orphaned. Aliases are unique on source and code across the whole table, so
 * there is nothing to collide with.
 */
const adminMergeSkus = adminProcedure
  .input(mergeSkusSchema)
  .mutation(async ({ input }) => {
    const { fromSkuId, intoSkuId } = input;

    if (fromSkuId === intoSkuId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'A SKU cannot be merged into itself',
      });
    }

    const skus = await client<{ id: string; wCode: string }[]>`
      SELECT id, w_code AS "wCode" FROM tri_skus
      WHERE id IN (${fromSkuId}, ${intoSkuId})
    `;

    if (skus.length !== 2) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'SKU not found' });
    }

    // Captured before the move, since afterwards nothing points at the source.
    const affected = await client<{ id: string; aliasSource: TriAliasSource }[]>`
      SELECT DISTINCT i.id, i.alias_source AS "aliasSource"
      FROM tri_imports i
      JOIN tri_import_lines l ON l.import_id = i.id
      WHERE l.sku_id IN (${fromSkuId}, ${intoSkuId})
    `;

    const [aliases] = await client<{ moved: number }[]>`
      WITH moved AS (
        UPDATE tri_sku_aliases SET sku_id = ${intoSkuId}, updated_at = NOW()
        WHERE sku_id = ${fromSkuId}
        RETURNING id
      )
      SELECT COUNT(*)::int AS moved FROM moved
    `;

    const [lines] = await client<{ moved: number }[]>`
      WITH moved AS (
        UPDATE tri_import_lines SET sku_id = ${intoSkuId}, updated_at = NOW()
        WHERE sku_id = ${fromSkuId}
        RETURNING id
      )
      SELECT COUNT(*)::int AS moved FROM moved
    `;

    await client`DELETE FROM tri_skus WHERE id = ${fromSkuId}`;

    // Pack size and bottle counts belong to the surviving SKU now.
    for (const record of affected) {
      await mapImportLines(record.id, record.aliasSource);
    }

    return {
      aliasesMoved: aliases?.moved ?? 0,
      linesMoved: lines?.moved ?? 0,
      recalculatedImports: affected.length,
    };
  });

export default adminMergeSkus;
