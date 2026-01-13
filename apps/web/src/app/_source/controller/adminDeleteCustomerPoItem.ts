import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourceCustomerPoItems, sourceCustomerPos } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

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
 * Delete a Customer PO item
 *
 * @example
 *   await trpcClient.source.admin.customerPo.deleteItem.mutate({
 *     id: "uuid-here",
 *   });
 */
const adminDeleteCustomerPoItem = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input }) => {
    try {
      const { id } = input;

      // Get the item to find its parent PO
      const [item] = await db
        .select({ customerPoId: sourceCustomerPoItems.customerPoId })
        .from(sourceCustomerPoItems)
        .where(eq(sourceCustomerPoItems.id, id))
        .limit(1);

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found',
        });
      }

      // Delete the item
      await db
        .delete(sourceCustomerPoItems)
        .where(eq(sourceCustomerPoItems.id, id));

      // Update customer PO item count
      await db
        .update(sourceCustomerPos)
        .set({
          itemCount: sql`GREATEST(${sourceCustomerPos.itemCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(sourceCustomerPos.id, item.customerPoId));

      // Recalculate customer PO totals
      await recalculateCustomerPoTotals(item.customerPoId);

      return { success: true };
    } catch (error) {
      logger.error('Error deleting Customer PO item:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete item. Please try again.',
      });
    }
  });

export default adminDeleteCustomerPoItem;
