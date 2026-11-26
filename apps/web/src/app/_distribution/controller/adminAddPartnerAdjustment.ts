import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import tableReady from '../utils/tableReady';

/**
 * A one-off line on a partner's or brand's statement for the month
 *
 * Sophie, 24 Nov 2026: the Compass Box 10% on the Super Cellar order, or a
 * payment already made. Positive adds to what we owe them, negative takes off.
 *
 * @param month - YYYY-MM
 * @param payee - The statement's name, as the page shows it
 * @param partnerId - The partner, where the payee is one
 * @param description - What the line is for
 * @param amount - USD
 * @returns The new line's id
 */
const adminAddPartnerAdjustment = adminProcedure
  .input(
    z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
      payee: z.string().trim().min(1).max(200),
      partnerId: z.string().uuid().nullish(),
      description: z.string().trim().min(3).max(500),
      amount: z.number().finite().min(-1_000_000).max(1_000_000),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await tableReady('cons_partner_adjustments'))) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Statement adjustments are not available until the latest migration has run.',
      });
    }

    const [row] = await client<{ id: string }[]>`
      INSERT INTO cons_partner_adjustments (month, payee, partner_id, description, amount, created_by)
      VALUES (${input.month}, ${input.payee}, ${input.partnerId ?? null}, ${input.description},
              ${input.amount}, ${ctx.user.id})
      RETURNING id
    `;

    return { id: row!.id };
  });

export default adminAddPartnerAdjustment;
