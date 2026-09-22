import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

export interface WineHit {
  lwin18: string;
  productName: string;
  producer: string | null;
  /** Bottles already invoiced out to this outlet, where any have been */
  outBottles: number | null;
  ownerName: string | null;
}

/**
 * Find one of our wines by name, anywhere in the catalogue
 *
 * The picker used to offer only wines with a consignment movement already
 * against them, which quietly excluded the ones most in need of matching. A
 * wine pushed to the distributor on an invoice nobody could attribute — no
 * tag, a MIX heading the API drops, an owner named OpenCellar that matches
 * nothing — has no out movement at all. It is sitting on their shelf and was
 * absent from the only list offering to name it.
 *
 * So the search reads the catalogue. Where the wine does have a position it is
 * shown alongside, because that is the check on a match; where it has none the
 * wine can still be claimed, and the position arrives when the invoice behind
 * it is read properly.
 *
 * @param term - What to search for, by wine, producer or LWIN
 * @param outletId - The outlet, to report any position already recorded
 * @returns Matching wines, those already consigned here first
 */
const adminSearchWines = adminProcedure
  .input(
    z.object({
      term: z.string().min(2).max(120),
      outletId: z.string().uuid(),
    }),
  )
  .query(async ({ input }) => {
    const like = `%${input.term.trim()}%`;

    const rows = await client<WineHit[]>`
      SELECT p.lwin18,
             p.name AS "productName",
             p.producer,
             out_lines.bottles AS "outBottles",
             out_lines.owner_name AS "ownerName"
      FROM products p
      LEFT JOIN (
        SELECT m.lwin18,
               SUM(m.bottles)::float8 AS bottles,
               MIN(ow.name) AS owner_name
        FROM cons_movements m
        JOIN cons_arrangements a ON a.id = m.arrangement_id
        JOIN cons_owners ow ON ow.id = a.owner_id
        WHERE a.outlet_id = ${input.outletId} AND m.kind = 'out'
        GROUP BY m.lwin18
      ) out_lines ON out_lines.lwin18 = p.lwin18
      /*
        A LWIN is eighteen digits. The catalogue carries rows keyed
        "1360983:row131" from an import that never finished, and offering one
        as a wine to settle money against is worse than offering nothing.
      */
      WHERE p.lwin18 ~ '^[0-9]{18}$'
        AND (
          p.name ILIKE ${like}
          OR p.producer ILIKE ${like}
          OR p.lwin18 ILIKE ${like}
        )
      /* A wine already consigned here is the likelier answer, so it leads */
      ORDER BY out_lines.bottles DESC NULLS LAST, p.name
      LIMIT 20
    `;

    return { wines: rows };
  });

export default adminSearchWines;
