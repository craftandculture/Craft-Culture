import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import wineClosedReady from '../utils/wineClosedReady';

/**
 * Close a line the distributor holds none of, or reopen it
 *
 * Recorded as a date, not a flag. A closed line is a statement about a moment
 * — they hold none of it today — and replenishment happens, so anything
 * invoiced out after that date reopens the line on its own, as does any stock
 * appearing against it on their feed. A flag would have to be remembered; a
 * date remembers itself.
 *
 * Nothing about the position changes. What sold is still sold and still owed
 * for; this only takes a finished line off the working view.
 *
 * @param outletId - The distributor
 * @param lwin18 - The wine
 * @param closed - True to close it, false to bring it back by hand
 * @returns The wine and its new standing
 */
const adminSetWineClosed = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      lwin18: z.string().min(1).max(50),
      closed: z.boolean(),
      productName: z.string().max(300).optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await wineClosedReady())) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Closing lines is not available yet — the cons_wine_closed ' +
          'migration has not run on this database.',
      });
    }

    if (!input.closed) {
      await client`
        DELETE FROM cons_wine_closed
        WHERE outlet_id = ${input.outletId} AND lwin18 = ${input.lwin18}
      `;

      return { lwin18: input.lwin18, closed: false };
    }

    await client`
      INSERT INTO cons_wine_closed (
        outlet_id, lwin18, product_name, closed_at, set_by
      )
      VALUES (
        ${input.outletId}, ${input.lwin18}, ${input.productName ?? null},
        CURRENT_DATE, ${ctx.user.id}
      )
      ON CONFLICT (outlet_id, lwin18) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        closed_at = CURRENT_DATE,
        set_by = EXCLUDED.set_by,
        updated_at = NOW()
    `;

    return { lwin18: input.lwin18, closed: true };
  });

export default adminSetWineClosed;
