import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import editableLinesInProgramme from '../data/editableLinesInProgramme';
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
  .input(setCodeIgnoredSchema.pick({ normalizedCode: true, programmeId: true }))
  .mutation(async ({ input }) => {
    const { normalizedCode, programmeId } = input;

    // This client's aliases and lines only: the same code can be another
    // client's wine, and lines in a locked period stay as signed off.
    const aliases = await client<{ id: string }[]>`
      DELETE FROM tri_sku_aliases
      WHERE normalized_code = ${normalizedCode}
        AND programme_id = ${programmeId}
      RETURNING id
    `;

    const lines = await client<{ id: string }[]>`
      UPDATE tri_import_lines
      SET sku_id = NULL, status = 'unmapped', updated_at = NOW()
      WHERE normalized_code = ${normalizedCode}
        AND status = 'mapped'
        AND ${editableLinesInProgramme(programmeId)}
      RETURNING id
    `;

    return { aliasesRemoved: aliases.length, linesReturned: lines.length };
  });

export default adminUnmapCode;
