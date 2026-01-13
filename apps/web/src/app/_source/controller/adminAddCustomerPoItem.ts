import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { sourceCustomerPoItems, sourceCustomerPos } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import addCustomerPoItemSchema from '../schemas/addCustomerPoItemSchema';
import { calculateItemProfit } from '../utils/calculateProfitAnalysis';

/**
 * Add an item to a Customer PO
 *
 * @example
 *   await trpcClient.source.admin.customerPo.addItem.mutate({
 *     customerPoId: "uuid-here",
 *     productName: "Chateau Margaux",
 *     vintage: "2019",
 *     quantityCases: 2,
 *     sellPricePerCaseUsd: 1500,
 *   });
 */
const adminAddCustomerPoItem = adminProcedure
  .input(addCustomerPoItemSchema)
  .mutation(async ({ input }) => {
    try {
      // Verify customer PO exists
      const [customerPo] = await db
        .select({ id: sourceCustomerPos.id })
        .from(sourceCustomerPos)
        .where(eq(sourceCustomerPos.id, input.customerPoId))
        .limit(1);

      if (!customerPo) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer PO not found',
        });
      }

      // Get next sort order
      const [maxSort] = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${sourceCustomerPoItems.sortOrder}), 0)` })
        .from(sourceCustomerPoItems)
        .where(eq(sourceCustomerPoItems.customerPoId, input.customerPoId));

      const sortOrder = (maxSort?.maxOrder ?? 0) + 1;

      // Calculate line totals
      const sellLineTotalUsd =
        input.sellPricePerCaseUsd && input.quantityCases
          ? input.sellPricePerCaseUsd * input.quantityCases
          : null;

      // Calculate profit (no buy price yet, so just set sell side)
      const profitCalc = calculateItemProfit({
        sellPricePerCaseUsd: input.sellPricePerCaseUsd || null,
        buyPricePerCaseUsd: null,
        quantityCases: input.quantityCases || null,
      });

      const [item] = await db
        .insert(sourceCustomerPoItems)
        .values({
          customerPoId: input.customerPoId,
          productName: input.productName,
          producer: input.producer || null,
          vintage: input.vintage || null,
          region: input.region || null,
          country: input.country || null,
          lwin: input.lwin || null,
          quantityCases: input.quantityCases || null,
          quantityBottles: input.quantityBottles || null,
          caseConfig: input.caseConfig || null,
          bottleSize: input.bottleSize || null,
          sellPricePerCaseUsd: input.sellPricePerCaseUsd || null,
          sellPricePerBottleUsd: input.sellPricePerBottleUsd || null,
          sellLineTotalUsd,
          status: 'pending_match',
          matchSource: 'manual',
          notes: input.notes || null,
          sortOrder,
          profitUsd: profitCalc.profitUsd,
          profitMarginPercent: profitCalc.profitMarginPercent,
          isLosingItem: profitCalc.isLosingItem,
        })
        .returning();

      if (!item) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add item',
        });
      }

      // Update customer PO item count
      await db
        .update(sourceCustomerPos)
        .set({
          itemCount: sql`${sourceCustomerPos.itemCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(sourceCustomerPos.id, input.customerPoId));

      return item;
    } catch (error) {
      logger.error('Error adding Customer PO item:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to add item. Please try again.',
      });
    }
  });

export default adminAddCustomerPoItem;
