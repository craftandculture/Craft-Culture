import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { pricingItems, pricingSessions } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import type { CalculationVariables } from '../schemas/calculationVariablesSchema';
import recalculateItemPrices from '../utils/recalculateItemPrices';

/**
 * Update case config for a single pricing item and recalculate prices
 *
 * @example
 *   await trpcClient.pricingCalc.item.updateCaseConfig.mutate({
 *     itemId: 'uuid-here',
 *     caseConfig: 12,
 *   });
 */
const itemUpdateCaseConfig = adminProcedure
  .input(
    z.object({
      itemId: z.string().uuid(),
      caseConfig: z.number().int().min(1).max(48),
    }),
  )
  .mutation(async ({ input }) => {
    const { itemId, caseConfig } = input;

    // Get item and its session variables
    const [item] = await db
      .select({
        item: pricingItems,
        calculationVariables: pricingSessions.calculationVariables,
      })
      .from(pricingItems)
      .innerJoin(pricingSessions, eq(pricingItems.sessionId, pricingSessions.id))
      .where(eq(pricingItems.id, itemId))
      .limit(1);

    if (!item) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pricing item not found',
      });
    }

    if (!item.calculationVariables) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Session has no calculation variables',
      });
    }

    const variables = item.calculationVariables as CalculationVariables;

    // Recalculate prices with new case config
    const recalculated = recalculateItemPrices({
      ukInBondPrice: item.item.ukInBondPrice,
      inputCurrency: item.item.inputCurrency,
      caseConfig,
    }, variables);

    // Update item
    await db
      .update(pricingItems)
      .set({
        caseConfig,
        inBondCaseUsd: recalculated.inBondCaseUsd,
        inBondBottleUsd: recalculated.inBondBottleUsd,
        inBondCaseAed: recalculated.inBondCaseAed,
        inBondBottleAed: recalculated.inBondBottleAed,
        deliveredCaseUsd: recalculated.deliveredCaseUsd,
        deliveredBottleUsd: recalculated.deliveredBottleUsd,
        deliveredCaseAed: recalculated.deliveredCaseAed,
        deliveredBottleAed: recalculated.deliveredBottleAed,
        updatedAt: new Date(),
      })
      .where(eq(pricingItems.id, itemId));

    return {
      success: true,
      itemId,
      caseConfig,
    };
  });

export default itemUpdateCaseConfig;
