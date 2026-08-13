import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { setCodeIgnoredSchema } from '../schemas/triangulationSchemas';

/**
 * Mark a product code as nothing to do with this reconciliation
 *
 * The Zoho invoices to City Drinks carry every wine C&C sells them, not only
 * the owner's. Most unresolved codes are therefore not missing mappings at all
 * — they are other people's stock, and forcing a W code onto them would move
 * someone else's bottles into these figures.
 *
 * Ignoring is not the same as leaving a code unmapped. Both are excluded from
 * the totals, but an unmapped code is an open question that keeps the queue
 * red, while an ignored one is a decision that has been made. Only the first
 * should be counted against the figures' completeness.
 *
 * The decision sticks: re-mapping preserves it, and the same code arriving in
 * next month's file is ignored again without being asked twice.
 */
const adminSetCodeIgnored = adminProcedure
  .input(setCodeIgnoredSchema)
  .mutation(async ({ input }) => {
    const { normalizedCode, ignore } = input;

    const updated = await client<{ id: string }[]>`
      UPDATE tri_import_lines
      SET status = ${ignore ? 'ignored' : 'unmapped'},
          sku_id = ${ignore ? null : client`sku_id`},
          updated_at = NOW()
      WHERE normalized_code = ${normalizedCode}
        AND status = ${ignore ? 'unmapped' : 'ignored'}
      RETURNING id
    `;

    return { normalizedCode, ignored: ignore, lines: updated.length };
  });

export default adminSetCodeIgnored;
