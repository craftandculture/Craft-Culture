import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  sourceCustomerPoItems,
  sourceCustomerPos,
  sourceRfqItems,
  sourceRfqQuotes,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { calculateItemProfit } from '../utils/calculateProfitAnalysis';

const bulkChangeSupplierSchema = z.object({
  customerPoId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1),
  partnerId: z.string().uuid(),
});

/**
 * Normalize string for fuzzy matching
 */
const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/château|chateau|domaine|dom\./gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

/**
 * Bulk change the supplier for selected Customer PO items
 *
 * Re-matches the selected items to quotes from the specified partner.
 *
 * @example
 *   await trpcClient.source.admin.customerPo.bulkChangeSupplier.mutate({
 *     customerPoId: "uuid",
 *     itemIds: ["item-1", "item-2"],
 *     partnerId: "partner-uuid",
 *   });
 */
const adminBulkChangeSupplier = adminProcedure
  .input(bulkChangeSupplierSchema)
  .mutation(async ({ input }) => {
    const { customerPoId, itemIds, partnerId } = input;

    try {
      // Get the customer PO with linked RFQ
      const [customerPo] = await db
        .select()
        .from(sourceCustomerPos)
        .where(eq(sourceCustomerPos.id, customerPoId))
        .limit(1);

      if (!customerPo) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer PO not found',
        });
      }

      if (!customerPo.rfqId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Customer PO must be linked to an RFQ',
        });
      }

      // Get partner name
      const [partner] = await db
        .select({ businessName: partners.businessName })
        .from(partners)
        .where(eq(partners.id, partnerId))
        .limit(1);

      if (!partner) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Partner not found',
        });
      }

      // Get the selected PO items
      const poItems = await db
        .select()
        .from(sourceCustomerPoItems)
        .where(
          and(
            eq(sourceCustomerPoItems.customerPoId, customerPoId),
            inArray(sourceCustomerPoItems.id, itemIds)
          )
        );

      if (poItems.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No items found',
        });
      }

      // Get all RFQ items for the linked RFQ
      const rfqItems = await db
        .select()
        .from(sourceRfqItems)
        .where(eq(sourceRfqItems.rfqId, customerPo.rfqId));

      // Get all quotes from this partner
      const rfqItemIds = rfqItems.map((i) => i.id);
      const partnerQuotes = await db
        .select()
        .from(sourceRfqQuotes)
        .where(
          and(
            inArray(sourceRfqQuotes.rfqItemId, rfqItemIds),
            eq(sourceRfqQuotes.partnerId, partnerId),
            isNotNull(sourceRfqQuotes.costPricePerCaseUsd)
          )
        );

      // Match each PO item to a quote from this partner
      let matchedCount = 0;
      let unmatchedCount = 0;

      for (const poItem of poItems) {
        // Find matching RFQ items
        const matchingRfqItems = rfqItems.filter((rfqItem) => {
          // Match by LWIN if both have it
          if (poItem.lwin && rfqItem.lwin) {
            return poItem.lwin === rfqItem.lwin;
          }
          // Match by normalized product name
          const poName = normalizeString(poItem.productName || '');
          const rfqName = normalizeString(rfqItem.productName || '');
          return (
            poName === rfqName ||
            poName.includes(rfqName) ||
            rfqName.includes(poName)
          );
        });

        // Find the partner's quote for any of these RFQ items
        let bestQuote = null;
        for (const rfqItem of matchingRfqItems) {
          const quote = partnerQuotes.find((q) => q.rfqItemId === rfqItem.id);
          if (quote) {
            // Prefer exact vintage match
            if (
              quote.quotedVintage === poItem.vintage ||
              !bestQuote
            ) {
              bestQuote = quote;
            }
          }
        }

        if (bestQuote) {
          // Calculate profit
          const profitCalc = calculateItemProfit({
            sellPricePerCaseUsd: poItem.sellPricePerCaseUsd,
            buyPricePerCaseUsd: bestQuote.costPricePerCaseUsd,
            quantityCases: poItem.quantity,
          });

          // Calculate line totals
          const buyLineTotalUsd =
            bestQuote.costPricePerCaseUsd && poItem.quantity
              ? bestQuote.costPricePerCaseUsd * poItem.quantity
              : null;

          // Update the item
          await db
            .update(sourceCustomerPoItems)
            .set({
              matchedQuoteId: bestQuote.id,
              matchedRfqItemId: bestQuote.rfqItemId,
              buyPricePerCaseUsd: bestQuote.costPricePerCaseUsd,
              buyLineTotalUsd,
              profitUsd: profitCalc.profitUsd,
              profitMarginPercent: profitCalc.profitMarginPercent,
              isLosingItem: profitCalc.isLosingItem,
              status: 'matched',
              matchSource: 'manual',
              updatedAt: new Date(),
            })
            .where(eq(sourceCustomerPoItems.id, poItem.id));

          matchedCount++;
        } else {
          unmatchedCount++;
        }
      }

      // Recalculate customer PO totals
      const allItems = await db
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

      allItems.forEach((item) => {
        if (item.sellLineTotalUsd) totalSellPriceUsd += item.sellLineTotalUsd;
        if (item.buyLineTotalUsd) totalBuyPriceUsd += item.buyLineTotalUsd;
        if (item.isLosingItem) losingItemCount++;
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
          losingItemCount,
          updatedAt: new Date(),
        })
        .where(eq(sourceCustomerPos.id, customerPoId));

      logger.dev(
        `Bulk changed supplier to ${partner.businessName}: ${matchedCount} matched, ${unmatchedCount} unmatched`
      );

      return {
        success: true,
        matchedCount,
        unmatchedCount,
        partnerName: partner.businessName,
      };
    } catch (error) {
      logger.error('Error bulk changing supplier:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to change supplier. Please try again.',
      });
    }
  });

export default adminBulkChangeSupplier;
