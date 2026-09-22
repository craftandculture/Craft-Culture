import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import wineBoughtReady from '../utils/wineBoughtReady';

/**
 * Say the distributor buys this line now, rather than holding it for us
 *
 * A fast mover they would rather own. City Drinks take the line onto their own
 * book, consignment on it ends, and their stock of it answers to nobody here —
 * so leaving it in the position produces a total that reads right and is not:
 * bottles counted as ours to be settled, which were sold to them outright.
 *
 * Everything already consigned and sold before the switch stays where it is.
 * This ends the line, it does not rewrite its history, because the owner is
 * still owed for whatever went before.
 *
 * Reversible, because a line can go back on consignment and because the
 * judgement is sometimes made early.
 *
 * @param outletId - The distributor
 * @param lwin18 - The wine
 * @param bought - True to end consignment on it, false to resume
 * @returns The wine and its new standing
 */
const adminSetWineBought = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      lwin18: z.string().min(1).max(50),
      bought: z.boolean(),
      productName: z.string().max(300).optional(),
      note: z.string().max(300).optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await wineBoughtReady())) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Bought lines are not available yet — the cons_wine_bought ' +
          'migration has not run on this database.',
      });
    }

    if (!input.bought) {
      await client`
        DELETE FROM cons_wine_bought
        WHERE outlet_id = ${input.outletId} AND lwin18 = ${input.lwin18}
      `;

      return { lwin18: input.lwin18, bought: false };
    }

    await client`
      INSERT INTO cons_wine_bought (
        outlet_id, lwin18, product_name, note, set_by
      )
      VALUES (
        ${input.outletId}, ${input.lwin18}, ${input.productName ?? null},
        ${input.note ?? null}, ${ctx.user.id}
      )
      ON CONFLICT (outlet_id, lwin18) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        note = EXCLUDED.note,
        set_by = EXCLUDED.set_by,
        updated_at = NOW()
    `;

    return { lwin18: input.lwin18, bought: true };
  });

export default adminSetWineBought;
