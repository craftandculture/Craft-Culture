import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

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

    const lines = await client<
      {
        outletCode: string | null;
        productName: string | null;
        bottles: number;
        reason: string | null;
      }[]
    >`
      SELECT outlet_code AS "outletCode", product_name AS "productName",
             bottles::float8, reason
      FROM cons_import_unmatched
      WHERE outlet_id = ${input.outletId} AND month = ${input.month}
      ORDER BY bottles DESC
    `;

    return {
      lines,
      bottles: lines.reduce((sum, line) => sum + line.bottles, 0),
    };
  });

export default adminGetUnmatchedLines;
