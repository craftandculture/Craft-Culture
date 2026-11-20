import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import assertMonthOpen from '../utils/assertMonthOpen';
import tableReady from '../utils/tableReady';

/**
 * Record a one-off correction to a month with an outlet
 *
 * Murrieta 170th sold twelve in September and was reported as two; an
 * overcharge was refunded. These were added to the run by hand and lived
 * nowhere. Each is now a line on the month: added to what the outlet owes
 * (a negative amount reduces it), and optionally to what one owner is paid.
 *
 * @param outletId - The outlet
 * @param month - The month it applies to, YYYY-MM
 * @param description - What it is, as the outlet will read it
 * @param amount - Added to what the outlet owes (negative reduces it)
 * @param ownerId - The owner it concerns, if any
 * @param ownerAmount - Added to what that owner is paid, if anything
 * @returns The new adjustment's id
 */
const adminAddAdjustment = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
      description: z.string().trim().min(3).max(500),
      amount: z.number().finite().min(-1_000_000).max(1_000_000),
      ownerId: z.string().uuid().nullish(),
      ownerAmount: z.number().finite().min(-1_000_000).max(1_000_000).nullish(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await tableReady('cons_adjustments'))) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Adjustments are not available on this database yet.',
      });
    }

    await assertMonthOpen(input.outletId, input.month);

    const [row] = await client<{ id: string }[]>`
      INSERT INTO cons_adjustments
        (outlet_id, month, description, amount, owner_id, owner_amount, created_by)
      VALUES (
        ${input.outletId}, ${input.month}, ${input.description}, ${input.amount},
        ${input.ownerId ?? null}, ${input.ownerAmount ?? null}, ${ctx.user.id}
      )
      RETURNING id
    `;

    return { id: row!.id };
  });

export default adminAddAdjustment;
