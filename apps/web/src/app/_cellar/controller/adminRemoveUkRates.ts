import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarUkRates } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

/**
 * Take away a version of the UK rates that was entered in error
 *
 * For a mistake, not a price change: a change is a new version from its own
 * date, so the old prices still stand for the months they covered. On
 * 20 October 2026 the member prices were entered as LCB's cost, which put the
 * recharge on twice.
 *
 * @example
 *   await trpcClient.cellar.admin.removeUkRates.mutate({ id });
 */
const adminRemoveUkRates = staffAdminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const [removed] = await db
      .delete(cellarUkRates)
      .where(eq(cellarUkRates.id, input.id))
      .returning({ id: cellarUkRates.id });

    if (!removed) throw new TRPCError({ code: 'NOT_FOUND', message: 'That version has already gone.' });

    return { removed: true };
  });

export default adminRemoveUkRates;
