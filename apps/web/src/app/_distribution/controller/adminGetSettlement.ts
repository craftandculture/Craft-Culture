import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import buildMonthSettlement from '../data/buildMonthSettlement';

/**
 * The month's settlement with an outlet, as the Distribution page shows it
 *
 * @param outletId - The outlet
 * @param month - YYYY-MM
 * @returns The CD statement, already billed, owner payouts, exceptions and the bottle check
 */
const adminGetSettlement = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
    }),
  )
  .query(async ({ input }) => buildMonthSettlement(input));

export default adminGetSettlement;
