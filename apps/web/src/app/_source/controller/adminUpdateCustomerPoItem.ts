import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceCustomerPoItems, sourceCustomerPos } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import updateCustomerPoItemSchema from '../schemas/updateCustomerPoItemSchema';
import { calculateItemProfit } from '../utils/calculateProfitAnalysis';

/**
 * Recalculate totals for a Customer PO based on its items
 */
const recalculateCustomerPoTotals = async (customerPoId: string) => {
  const items = await db
    .select({
      sellLineTotalUsd: sourceCustomerPoItems.sellLineTotalUsd,
      buyLineTotalUsd: sourceCustomerPoItems.buyLineTotalUsd,
      isLosingItem: sourceCustomerPoItems.isLosingItem,
    })
    .from(sourceCustomerPoItems)
    .where(eq(sourceCustomerPoItems.customerPoId, customerPoId));

  let totalSellPriceUsd = 0;
  let totalBuyPriceUsd = 0;
  let losingItemCount = 0;

  items.forEach((item) => {
    if (item.sellLineTotalUsd) {
      totalSellPriceUsd += item.sellLineTotalUsd;
    }
    if (item.buyLineTotalUsd) {
      totalBuyPriceUsd += item.buyLineTotalUsd;
    }
    if (item.isLosingItem) {
      losingItemCount++;
    }
  });

  const totalProfitUsd = totalSellPriceUsd - totalBuyPriceUsd;
  const profitMarginPercent =
    totalSellPriceUsd > 0 ? (totalProfitUsd / totalSellPriceUsd) * 100 : 0;

  await db
    .update(sourceCustomerPos)
    .set({
      totalSellPriceUsd: Math.round(totalSellPriceUsd * 100) / 100,
      totalBuyPriceUsd: Math.round(totalBuyPriceUsd * 100) / 100,
      totalProfitUsd: Math.round(totalProfitUsd * 100) / 100,
      profitMarginPercent: Math.round(profitMarginPercent * 100) / 100,
      itemCount: items.length,
      losingItemCount,
      updatedAt: new Date(),
    })
    .where(eq(sourceCustomerPos.id, customerPoId));
};

/**
 * Update a Customer PO item
 *
 * @example
 *   await trpcClient.source.admin.customerPo.updateItem.mutate({
 *     id: "uuid-here",
 *     matchedQuoteId: "quote-uuid",
 *     buyPricePerCaseUsd: 1200,
 *   });
 */
const adminUpdateCustomerPoItem = adminProcedure
  .input(updateCustomerPoItemSchema)
  .mutation(async ({ input }) => {
    try {
      const { id, ...updateData } = input;

      // Get existing item
      const [existingItem] = await db
        .select()
        .from(sourceCustomerPoItems)
        .where(eq(sourceCustomerPoItems.id, id))
        .limit(1);

      if (!existingItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found',
        });
      }

      // Merge existing values with updates
      const sellPricePerCaseUsd =
        updateData.sellPricePerCaseUsd !== undefined
          ? updateData.sellPricePerCaseUsd
          : existingItem.sellPricePerCaseUsd;
      const buyPricePerCaseUsd =
        updateData.buyPricePerCaseUsd !== undefined
          ? updateData.buyPricePerCaseUsd
          : existingItem.buyPricePerCaseUsd;
      const quantity =
        updateData.quantity !== undefined
          ? updateData.quantity
          : existingItem.quantity;

      // Recalculate profit
      const profitCalc = calculateItemProfit({
        sellPricePerCaseUsd,
        buyPricePerCaseUsd,
        quantityCases: quantity,
      });

      // Calculate line totals
      const sellLineTotalUsd =
        sellPricePerCaseUsd && quantity
          ? sellPricePerCaseUsd * quantity
          : null;
      const buyLineTotalUsd =
        buyPricePerCaseUsd && quantity
          ? buyPricePerCaseUsd * quantity
          : null;

      // Determine status based on match
      let newStatus = existingItem.status;
      if (
        updateData.matchedQuoteId !== undefined &&
        updateData.matchedQuoteId !== null
      ) {
        newStatus = 'matched';
      } else if (
        updateData.matchedQuoteId === null &&
        existingItem.matchedQuoteId !== null
      ) {
        newStatus = 'pending_match';
      }

      const [updatedItem] = await db
        .update(sourceCustomerPoItems)
        .set({
          ...updateData,
          sellLineTotalUsd,
          buyLineTotalUsd,
          profitUsd: profitCalc.profitUsd,
          profitMarginPercent: profitCalc.profitMarginPercent,
          isLosingItem: profitCalc.isLosingItem,
          status: updateData.status || newStatus,
          updatedAt: new Date(),
        })
        .where(eq(sourceCustomerPoItems.id, id))
        .returning();

      if (!updatedItem) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update item',
        });
      }

      // Recalculate customer PO totals
      await recalculateCustomerPoTotals(existingItem.customerPoId);

      return updatedItem;
    } catch (error) {
      logger.error('Error updating Customer PO item:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update item. Please try again.',
      });
    }
  });

export default adminUpdateCustomerPoItem;
