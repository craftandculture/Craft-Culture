import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import { deleteAliasSchema } from '../schemas/triangulationSchemas';
import type { TriAliasSource } from '../schemas/triangulationSchemas';

/**
 * Remove an external code mapping and unwind it from the imports it touched
 *
 * Every import that used the code is re-mapped, so a mistaken mapping stops
 * contributing to the reconciliation immediately rather than lingering until
 * the next upload.
 */
const adminDeleteAlias = adminProcedure
  .input(deleteAliasSchema)
  .mutation(async ({ input }) => {
    const { aliasId } = input;

    const [alias] = await client<
      { normalizedCode: string; source: TriAliasSource }[]
    >`
      SELECT normalized_code AS "normalizedCode", source
      FROM tri_sku_aliases WHERE id = ${aliasId} LIMIT 1
    `;

    if (!alias) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Alias not found' });
    }

    await client`DELETE FROM tri_sku_aliases WHERE id = ${aliasId}`;

    const affected = await client<{ id: string }[]>`
      SELECT DISTINCT i.id
      FROM tri_imports i
      JOIN tri_import_lines l ON l.import_id = i.id
      WHERE l.normalized_code = ${alias.normalizedCode}
        AND i.alias_source = ${alias.source}
    `;

    for (const record of affected) {
      await mapImportLines(record.id, alias.source);
    }

    return { aliasId, remappedImports: affected.length };
  });

export default adminDeleteAlias;
