import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import buildPartnerStatements from '../data/buildPartnerStatements';

/**
 * Each partner's month: consignment and outright sales, and the total owed
 *
 * @param outletId - The consignment outlet
 * @param month - YYYY-MM
 * @returns A row per partner and the outright lines behind them
 */
const adminGetPartnerStatements = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
    }),
  )
  .query(async ({ input }) => buildPartnerStatements(input));

export default adminGetPartnerStatements;
