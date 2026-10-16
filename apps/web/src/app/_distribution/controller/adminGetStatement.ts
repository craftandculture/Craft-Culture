import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import buildOwnerStatement from '../data/buildOwnerStatement';

export type { StatementLine } from '../data/buildOwnerStatement';

/**
 * What to tell an owner sold this month, and what we owe them for it
 *
 * The output the whole module exists for. City Drinks never send a settlement
 * invoice — we bill them. The owners are the other way round: we tell them
 * what sold and they invoice us against it, so this statement is what starts
 * the settlement rather than a report on one that happened.
 *
 * The work is in `buildOwnerStatement`, shared with the all-partners summary
 * so the two cannot answer one question differently.
 *
 * @param ownerId - Whose statement
 * @param outletId - Which outlet's sales
 * @param month - The month, as YYYY-MM
 * @returns One line per wine, with what is owed and what it was drawn from
 */
const adminGetStatement = adminProcedure
  .input(
    z.object({
      ownerId: z.string().uuid(),
      outletId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
    }),
  )
  .query(async ({ input }) => buildOwnerStatement(input));

export default adminGetStatement;
