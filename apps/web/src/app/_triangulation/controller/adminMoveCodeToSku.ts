import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import { moveCodeToSkuSchema } from '../schemas/triangulationSchemas';
import type { TriAliasSource } from '../schemas/triangulationSchemas';

/**
 * Point a product code at a different SKU, wherever it currently lands
 *
 * Mapping is otherwise only reachable from the unmapped queue, which means a
 * code that is already mapped — just mapped to the wrong wine — has no route
 * back. That is the harder case and the more common one: a W code and its
 * LWIN-style long form both exist in the registry, one holds the stock and the
 * other holds the invoices, and neither can be corrected because both are
 * technically resolved.
 *
 * Unlike a merge, both SKUs survive. Only the code moves, which is right when
 * the two are genuinely different bottlings and only one line was filed wrong.
 *
 * The alias is written under every party whose files carry the code, not just
 * one. A code appearing in both a City Drinks sheet and a Zoho invoice needs
 * both, or half the bottles stay where they were and the figure moves only
 * partway — worse than not moving at all, because it looks like it worked.
 */
const adminMoveCodeToSku = adminProcedure
  .input(moveCodeToSkuSchema)
  .mutation(async ({ input, ctx }) => {
    const { normalizedCode, skuId } = input;
    // Whatever was typed, so a dashed LWIN is not stored stripped of its
    // dashes and then shown back looking like a different code.
    const written = input.rawCode?.trim() || normalizedCode;

    const [sku] = await client<{ id: string; wCode: string }[]>`
      SELECT id, w_code AS "wCode" FROM tri_skus WHERE id = ${skuId} LIMIT 1
    `;

    if (!sku) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'SKU not found' });
    }

    // Every party whose imports carry this code, and the code as they wrote it.
    const sources = await client<
      { aliasSource: TriAliasSource; rawCode: string }[]
    >`
      SELECT DISTINCT
        i.alias_source AS "aliasSource",
        COALESCE(MIN(l.raw_code), ${normalizedCode}) AS "rawCode"
      FROM tri_import_lines l
      JOIN tri_imports i ON i.id = l.import_id
      WHERE l.normalized_code = ${normalizedCode}
      GROUP BY i.alias_source
    `;

    // A code nobody has invoiced yet is the normal case when someone is
    // mapping ahead of the paperwork — a Zoho item just corrected, a format
    // about to be sold. Refusing it made the one obvious way to record a
    // mapping fail exactly when it was most wanted; the alias is written under
    // every party instead, so the code resolves whoever writes it first.
    const targets: { aliasSource: TriAliasSource; rawCode: string }[] =
      sources.length > 0
        ? sources
        : (
            [
              'zoho',
              'city_drinks',
              'crurated',
              'packing_list',
              'other',
            ] as const
          ).map((aliasSource) => ({ aliasSource, rawCode: written }));

    for (const source of targets) {
      await client`
        INSERT INTO tri_sku_aliases (
          sku_id, source, alias_code, normalized_code, created_by
        )
        VALUES (
          ${skuId}, ${source.aliasSource}, ${source.rawCode},
          ${normalizedCode}, ${ctx.user.id}
        )
        ON CONFLICT (source, normalized_code) DO UPDATE SET
          sku_id = ${skuId},
          created_by = ${ctx.user.id},
          updated_at = NOW()
      `;
    }

    // Lines set aside as "not our stock" would survive the re-map still
    // ignored, silently swallowing the move.
    await client`
      UPDATE tri_import_lines
      SET status = 'unmapped', updated_at = NOW()
      WHERE normalized_code = ${normalizedCode} AND status = 'ignored'
    `;

    const affected = await client<
      { id: string; aliasSource: TriAliasSource }[]
    >`
      SELECT DISTINCT i.id, i.alias_source AS "aliasSource"
      FROM tri_imports i
      JOIN tri_import_lines l ON l.import_id = i.id
      WHERE l.normalized_code = ${normalizedCode}
    `;

    for (const record of affected) {
      await mapImportLines(record.id, record.aliasSource);
    }

    const [moved] = await client<{ lines: number; bottles: number }[]>`
      SELECT
        COUNT(*)::int AS lines,
        COALESCE(SUM(quantity_bottles), 0)::float8 AS bottles
      FROM tri_import_lines
      WHERE normalized_code = ${normalizedCode} AND sku_id = ${skuId}
    `;

    return {
      wCode: sku.wCode,
      sources: sources.map((source) => source.aliasSource),
      remappedImports: affected.length,
      lines: moved?.lines ?? 0,
      bottles: moved?.bottles ?? 0,
    };
  });

export default adminMoveCodeToSku;
