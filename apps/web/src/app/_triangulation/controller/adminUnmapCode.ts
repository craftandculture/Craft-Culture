import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { setCodeIgnoredSchema } from '../schemas/triangulationSchemas';

/**
 * Return a code to the mapping queue, undoing whatever sent it elsewhere
 *
 * A mapping that turned out to be wrong cannot be corrected by mapping it
 * again: the alias would simply re-apply on the next re-map. The alias has to
 * go with it, which is why this is one action rather than two.
 *
 * The route back from a merge that should not have happened, and from anything
 * auto-map took that it should have left alone.
 */
const adminUnmapCode = adminProcedure
  .input(setCodeIgnoredSchema.pick({ normalizedCode: true }))
  .mutation(async ({ input }) => {
    const { normalizedCode } = input;

    const aliases = await client<{ id: string }[]>`
      DELETE FROM tri_sku_aliases
      WHERE normalized_code = ${normalizedCode}
      RETURNING id
    `;

    const lines = await client<{ id: string }[]>`
      UPDATE tri_import_lines
      SET sku_id = NULL, status = 'unmapped', updated_at = NOW()
      WHERE normalized_code = ${normalizedCode}
        AND status = 'mapped'
      RETURNING id
    `;

    return { aliasesRemoved: aliases.length, linesReturned: lines.length };
  });

export default adminUnmapCode;
