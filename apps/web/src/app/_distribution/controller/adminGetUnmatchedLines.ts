import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import tableReady from '../utils/tableReady';
import unmatchedReady from '../utils/unmatchedReady';

/**
 * Lines on the distributor's sheet that reached no wine of ours
 *
 * Bottles they sold which we cannot attribute to an owner, and therefore
 * cannot bill anyone for. Counted in a toast once and then gone, which is the
 * same as dropping them — so they are kept against the month and shown until
 * somebody answers them.
 *
 * @param outletId - The distributor
 * @param month - The month, as YYYY-MM
 * @returns The lines and what they come to in bottles
 */
const adminGetUnmatchedLines = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
    }),
  )
  .query(async ({ input }) => {
    if (!(await unmatchedReady())) return { lines: [], bottles: 0 };

    const withSuggestions = await tableReady('cons_invoice_types');

    const lines = await client<
      {
        outletCode: string | null;
        productName: string | null;
        bottles: number;
        reason: string | null;
        suggestedOwnerName: string | null;
        suggestedLwin18: string | null;
        suggestedName: string | null;
        suggestedWhy: string | null;
        candidateOwners: { id: string; name: string }[] | null;
      }[]
    >`
      SELECT u.outlet_code AS "outletCode", u.product_name AS "productName",
             u.bottles::float8, u.reason,
             ${
               withSuggestions
                 ? client`ow.name AS "suggestedOwnerName",
                          u.suggested_lwin18 AS "suggestedLwin18",
                          u.suggested_name AS "suggestedName",
                          u.suggested_why AS "suggestedWhy",
                          (
                            SELECT JSON_AGG(JSON_BUILD_OBJECT('id', c.id, 'name', c.name) ORDER BY c.name)
                            FROM cons_owners c
                            WHERE c.id = ANY(u.candidate_owner_ids)
                          ) AS "candidateOwners"`
                 : client`NULL::text AS "suggestedOwnerName",
                          NULL::text AS "suggestedLwin18",
                          NULL::text AS "suggestedName",
                          NULL::text AS "suggestedWhy",
                          NULL::json AS "candidateOwners"`
             }
      FROM cons_import_unmatched u
      ${
        withSuggestions
          ? client`LEFT JOIN cons_owners ow ON ow.id = u.suggested_owner_id`
          : client``
      }
      WHERE u.outlet_id = ${input.outletId} AND u.month = ${input.month}
      ORDER BY u.bottles DESC
    `;

    return {
      lines,
      bottles: lines.reduce((sum, line) => sum + line.bottles, 0),
    };
  });

export default adminGetUnmatchedLines;
