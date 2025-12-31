import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { pricingSessions } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Delete a pricing session and all its items
 *
 * Items are deleted via cascade constraint
 *
 * @example
 *   await trpcClient.pricingCalc.session.delete.mutate({
 *     id: 'uuid-here',
 *   });
 */
const sessionDelete = adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
    }),
  )
  .mutation(async ({ input }) => {
    const [deleted] = await db
      .delete(pricingSessions)
      .where(eq(pricingSessions.id, input.id))
      .returning({ id: pricingSessions.id });

    if (!deleted) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pricing session not found',
      });
    }

    return { success: true };
  });

export default sessionDelete;
