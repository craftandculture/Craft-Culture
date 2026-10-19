import { z } from 'zod';

import db from '@/database/client';
import { cellarUkRates } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

const gbp = z.number().min(0).max(10_000);

/**
 * Record LCB's prices from the day they apply
 *
 * Never edits an earlier version: a price LCB charged in September stays the
 * price for September. A new version from a later date is how a rise is
 * entered; one from today replaces today's figures going forward.
 *
 * @example
 *   await trpcClient.cellar.admin.addUkRates.mutate({
 *     effectiveFrom: '2026-10-01', storagePerUnitMonthGbp: 1.2, receivePerCaseGbp: 0.9,
 *     handlingOutPerCaseGbp: 0.9, exportDocsPerMoveGbp: 25,
 *   });
 */
const adminAddUkRates = staffAdminProcedure
  .input(
    z.object({
      effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      storagePerUnitMonthGbp: gbp,
      receivePerCaseGbp: gbp,
      handlingOutPerCaseGbp: gbp,
      exportDocsPerMoveGbp: gbp,
      notes: z.string().trim().max(500).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [row] = await db
      .insert(cellarUkRates)
      .values({
        ...input,
        effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00Z`),
        notes: input.notes || null,
        createdBy: ctx.user.id,
      })
      .returning({ id: cellarUkRates.id });

    return { id: row!.id };
  });

export default adminAddUkRates;
