import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { pricingSessions } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import calculationVariablesSchema from '../schemas/calculationVariablesSchema';

/**
 * Update calculation variables for a pricing session
 *
 * @example
 *   await trpcClient.pricingCalc.session.updateVariables.mutate({
 *     id: 'uuid-here',
 *     variables: { inputCurrency: 'GBP', ... },
 *   });
 */
const sessionUpdateVariables = adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      variables: calculationVariablesSchema,
    }),
  )
  .mutation(async ({ input }) => {
    const { id, variables } = input;

    // Check session exists
    const [existing] = await db
      .select({ id: pricingSessions.id })
      .from(pricingSessions)
      .where(eq(pricingSessions.id, id))
      .limit(1);

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pricing session not found',
      });
    }

    // Update variables
    await db
      .update(pricingSessions)
      .set({
        calculationVariables: variables,
        status: 'mapped', // Reset status since variables changed
        updatedAt: new Date(),
      })
      .where(eq(pricingSessions.id, id));

    return { success: true };
  });

export default sessionUpdateVariables;
