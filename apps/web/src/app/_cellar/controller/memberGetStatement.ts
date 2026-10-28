import { z } from 'zod';

import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import buildMemberStatement from '../data/buildMemberStatement';

/**
 * A member's statement for one calendar month (see buildMemberStatement)
 *
 * @example
 *   const statement = await trpcClient.cellar.member.getStatement.query({
 *     month: '2026-09',
 *   });
 */
const memberGetStatement = stockOwnerProcedure
  .input(
    z.object({
      /** Calendar month, `YYYY-MM` */
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    }),
  )
  .query(async ({ ctx, input }) => {
    // The line-by-line working is for staff: it carries landed costs
    const { owedBreakdown: _staffOnly, ...statement } = await buildMemberStatement({
      partner: ctx.partner,
      month: input.month,
    });

    return statement;
  });

export default memberGetStatement;
