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

    const skus = await client<
      {
        id: string;
        wCode: string | null;
        lwin18: string | null;
        programmeId: string;
        ownerName: string | null;
      }[]
    >`
      SELECT id, w_code AS "wCode", lwin18,
             programme_id AS "programmeId", owner_name AS "ownerName"
      FROM tri_skus
      WHERE id IN (${fromSkuId}, ${intoSkuId})
    `;

    if (skus.length !== 2) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'SKU not found' });
    }

    const from = skus.find((sku) => sku.id === fromSkuId)!;
    const into = skus.find((sku) => sku.id === intoSkuId)!;

    /*
      Two clients' wines are not the same wine.

      Nothing compared programmes, so a merge could fold one client's registry
      entry into another's — taking its aliases and its import lines with it,
      and quietly moving bottles between owners. Duplicates within one client
      are the case this tool is for.
    */
    if (from.programmeId !== into.programmeId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'These wines belong to different clients. Merging would move one client’s bottles onto another’s registry — set the owner instead.',
      });
    }

    /*
      A LWIN is the wine's identity. Two different ones are two different
      wines however alike the names read, and merging them is unrecoverable
      once the aliases and lines have moved.
    */
    if (from.lwin18 && into.lwin18 && from.lwin18 !== into.lwin18) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `These carry different LWINs (${into.lwin18} and ${from.lwin18}), so they are different wines. Correct the wrong one first.`,
      });
    }

    // Captured before the move, since afterwards nothing points at the source.
    const affected = await client<{ id: string; aliasSource: TriAliasSource }[]>`
      SELECT DISTINCT i.id, i.alias_source AS "aliasSource"
      FROM tri_imports i
      JOIN tri_import_lines l ON l.import_id = i.id
      WHERE l.sku_id IN (${fromSkuId}, ${intoSkuId})
    `;

    /*
      An alias the survivor already holds cannot be moved onto it — the key is
      (programme_id, source, normalized_code) and the UPDATE would violate it,
      failing the whole merge. The duplicate's copy is dropped instead: it
      points at the same code for the same client, so nothing is lost.
    */
    await client`
      DELETE FROM tri_sku_aliases a
      WHERE a.sku_id = ${fromSkuId}
        AND EXISTS (
          SELECT 1 FROM tri_sku_aliases b
          WHERE b.sku_id = ${intoSkuId}
            AND b.programme_id = a.programme_id
            AND b.source = a.source
            AND b.normalized_code = a.normalized_code
        )
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

    /*
      The survivor inherits anything it is missing. A duplicate often carries
      the LWIN or the owner that the row being kept never had, and dropping it
      would throw away the better record of the two.
    */
    await client`
      UPDATE tri_skus SET
        lwin18 = COALESCE(lwin18, ${from.lwin18}),
        owner_name = COALESCE(owner_name, ${from.ownerName}),
        updated_at = NOW()
      WHERE id = ${intoSkuId}
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
