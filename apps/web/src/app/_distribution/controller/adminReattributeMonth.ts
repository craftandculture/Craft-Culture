import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import reattributeMonth from '../data/reattributeMonth';

/**
 * Run the month's matching again against what we know now
 *
 * For after the Codes tab is uploaded or an invoice is re-typed: the month's
 * bottles are re-attributed from the ledger, no sheet needed.
 *
 * @param outletId - The outlet
 * @param month - YYYY-MM
 * @returns What was attributed and what is still waiting
 */
const adminReattributeMonth = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
    }),
  )
  .mutation(async ({ input }) => {
    const result = await reattributeMonth(input);

    if (!result) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No sales are on file for ${input.month}. Upload the month's sheet first.`,
      });
    }

    return result;
  });

export default adminReattributeMonth;
