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

import notifyDistributorOfCustomerPoReceived from '../utils/notifyDistributorOfCustomerPoReceived';

const autoMatchSchema = z.object({
  customerPoId: z.string().uuid(),
});

interface MatchResult {
  itemId: string;
  productName: string;
  matchedQuoteId: string | null;
  matchedRfqItemId: string | null;
  matchSource: 'lwin' | 'product_name' | 'fuzzy' | null;
  buyPricePerCaseUsd: number | null;
  sellPricePerCaseUsd: number | null;
  profitUsd: number | null;
  profitMarginPercent: number | null;
  isLosingItem: boolean;
  supplierName: string | null;
}

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
 * Calculate similarity between two strings (0-1)
 */
const stringSimilarity = (a: string, b: string): number => {
  const normA = normalizeString(a);
  const normB = normalizeString(b);

  if (normA === normB) return 1;
  if (normA.includes(normB) || normB.includes(normA)) return 0.9;

  // Simple character overlap
  const setA = new Set(normA.split(''));
  const setB = new Set(normB.split(''));
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;

  return intersection / union;
};

/**
 * Auto-match customer PO items to RFQ quotes
 *
 * Matching strategy:
 * 1. Exact LWIN match
 * 2. Product name + vintage match
 * 3. Fuzzy product name match
 *
 * Then selects lowest-price supplier and calculates profit.
 *
 * @example
 *   await trpcClient.source.admin.customerPo.autoMatch.mutate({
 *     customerPoId: "uuid",
 *   });
 */
const adminAutoMatchCustomerPo = adminProcedure
  .input(autoMatchSchema)
  .mutation(async ({ input }) => {
    try {
      // Get the customer PO with linked RFQ
      const [customerPo] = await db
        .select()
        .from(sourceCustomerPos)
        .where(eq(sourceCustomerPos.id, input.customerPoId))
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
          message: 'Customer PO must be linked to an RFQ for auto-matching',
        });
      }

      // Get all PO items
      const poItems = await db
        .select()
        .from(sourceCustomerPoItems)
        .where(eq(sourceCustomerPoItems.customerPoId, input.customerPoId))
        .orderBy(sourceCustomerPoItems.sortOrder);

      if (poItems.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No items found in customer PO',
        });
      }

      // Get all RFQ items with their quotes
      const rfqItems = await db
        .select({
          id: sourceRfqItems.id,
          productName: sourceRfqItems.productName,
          producer: sourceRfqItems.producer,
          vintage: sourceRfqItems.vintage,
          lwin: sourceRfqItems.lwin,
        })
        .from(sourceRfqItems)
        .where(eq(sourceRfqItems.rfqId, customerPo.rfqId));

      // Build RFQ item lookup for LWIN matching
      const rfqItemMap = new Map(rfqItems.map((i) => [i.id, i]));

      // Get all quotes for this RFQ with prices (only confirmed/submitted quotes)
      const quotes = await db
        .select({
          id: sourceRfqQuotes.id,
          itemId: sourceRfqQuotes.itemId,
          partnerId: sourceRfqQuotes.partnerId,
          costPricePerCaseUsd: sourceRfqQuotes.costPricePerCaseUsd,
          quotedVintage: sourceRfqQuotes.quotedVintage,
        })
        .from(sourceRfqQuotes)
        .where(
          and(
            inArray(
              sourceRfqQuotes.itemId,
              rfqItems.map((i) => i.id)
            ),
            isNotNull(sourceRfqQuotes.costPricePerCaseUsd)
          )
        );

      // Get partner names for reference
      const partnerIds = [...new Set(quotes.map((q) => q.partnerId))];
      const partnerData = partnerIds.length > 0
        ? await db
            .select({ id: partners.id, businessName: partners.businessName })
            .from(partners)
            .where(inArray(partners.id, partnerIds))
        : [];
      const partnerMap = new Map(partnerData.map((p) => [p.id, p.businessName]));

      // Build lookup maps
      const quotesByLwin = new Map<string, typeof quotes>();
      const quotesByRfqItem = new Map<string, typeof quotes>();

      for (const quote of quotes) {
        // Group by LWIN (from the RFQ item)
        const rfqItem = rfqItemMap.get(quote.itemId);
        if (rfqItem?.lwin) {
          const lwinKey = rfqItem.lwin.substring(0, 7); // Use LWIN7 for matching
          const existing = quotesByLwin.get(lwinKey) || [];
          existing.push(quote);
          quotesByLwin.set(lwinKey, existing);
        }

        // Group by RFQ item
        const existing = quotesByRfqItem.get(quote.itemId) || [];
        existing.push(quote);
        quotesByRfqItem.set(quote.itemId, existing);
      }

      // Match each PO item
      const results: MatchResult[] = [];
      let matchedCount = 0;
      let losingCount = 0;

      for (const poItem of poItems) {
        let matchedQuote: (typeof quotes)[number] | null = null;
        let matchSource: MatchResult['matchSource'] = null;
        let matchedRfqItemId: string | null = null;

        // Strategy 1: Match by LWIN
        if (poItem.lwin) {
          const lwinKey = poItem.lwin.substring(0, 7);
          const lwinQuotes = quotesByLwin.get(lwinKey);
          if (lwinQuotes && lwinQuotes.length > 0) {
            // Get lowest price
            matchedQuote = lwinQuotes.reduce((best, curr) =>
              (curr.costPricePerCaseUsd ?? 0) < (best.costPricePerCaseUsd ?? 0)
                ? curr
                : best
            );
            matchSource = 'lwin';
            matchedRfqItemId = matchedQuote.itemId;
          }
        }

        // Strategy 2: Match by product name + vintage
        if (!matchedQuote) {
          for (const rfqItem of rfqItems) {
            const nameMatch = stringSimilarity(poItem.productName, rfqItem.productName) > 0.7;
            const vintageMatch =
              !poItem.vintage ||
              !rfqItem.vintage ||
              poItem.vintage === rfqItem.vintage;

            if (nameMatch && vintageMatch) {
              const itemQuotes = quotesByRfqItem.get(rfqItem.id);
              if (itemQuotes && itemQuotes.length > 0) {
                // Get lowest price
                const bestQuote = itemQuotes.reduce((best, curr) =>
                  (curr.costPricePerCaseUsd ?? 0) < (best.costPricePerCaseUsd ?? 0)
                    ? curr
                    : best
                );

                if (
                  !matchedQuote ||
                  (bestQuote.costPricePerCaseUsd ?? 0) <
                    (matchedQuote.costPricePerCaseUsd ?? 0)
                ) {
                  matchedQuote = bestQuote;
                  matchSource = 'product_name';
                  matchedRfqItemId = rfqItem.id;
                }
              }
            }
          }
        }

        // Strategy 3: Fuzzy match with lower threshold
        if (!matchedQuote) {
          let bestSimilarity = 0;
          for (const rfqItem of rfqItems) {
            const similarity = stringSimilarity(poItem.productName, rfqItem.productName);
            if (similarity > 0.5 && similarity > bestSimilarity) {
              const itemQuotes = quotesByRfqItem.get(rfqItem.id);
              if (itemQuotes && itemQuotes.length > 0) {
                const bestQuote = itemQuotes.reduce((best, curr) =>
                  (curr.costPricePerCaseUsd ?? 0) < (best.costPricePerCaseUsd ?? 0)
                    ? curr
                    : best
                );
                matchedQuote = bestQuote;
                matchSource = 'fuzzy';
                matchedRfqItemId = rfqItem.id;
                bestSimilarity = similarity;
              }
            }
          }
        }

        // Calculate profit
        const sellPrice = poItem.sellPricePerCaseUsd ?? null;
        const buyPrice = matchedQuote?.costPricePerCaseUsd ?? null;

        let profitUsd: number | null = null;
        let profitMarginPercent: number | null = null;
        let isLosingItem = false;

        if (sellPrice !== null && buyPrice !== null) {
          profitUsd = Math.round((sellPrice - buyPrice) * 100) / 100;
          profitMarginPercent =
            sellPrice > 0
              ? Math.round((profitUsd / sellPrice) * 10000) / 100
              : 0;
          isLosingItem = profitUsd < 0;
          if (isLosingItem) losingCount++;
        }

        if (matchedQuote) matchedCount++;

        const supplierName = matchedQuote
          ? partnerMap.get(matchedQuote.partnerId) || null
          : null;

        results.push({
          itemId: poItem.id,
          productName: poItem.productName,
          matchedQuoteId: matchedQuote?.id || null,
          matchedRfqItemId,
          matchSource,
          buyPricePerCaseUsd: buyPrice,
          sellPricePerCaseUsd: sellPrice,
          profitUsd,
          profitMarginPercent,
          isLosingItem,
          supplierName,
        });

        // Update the PO item
        await db
          .update(sourceCustomerPoItems)
          .set({
            matchedQuoteId: matchedQuote?.id || null,
            matchedRfqItemId: matchedRfqItemId || null,
            buyPricePerCaseUsd: buyPrice,
            buyLineTotalUsd:
              buyPrice !== null
                ? Math.round(buyPrice * poItem.quantity * 100) / 100
                : null,
            profitUsd: profitUsd !== null ? profitUsd * poItem.quantity : null,
            profitMarginPercent,
            isLosingItem,
            matchSource: matchSource ? 'auto' : null,
            status: matchedQuote ? 'matched' : 'unmatched',
          })
          .where(eq(sourceCustomerPoItems.id, poItem.id));
      }

      // Recalculate PO totals
      const totalSell = results.reduce(
        (sum, r) =>
          sum +
          (r.sellPricePerCaseUsd || 0) *
            (poItems.find((p) => p.id === r.itemId)?.quantity || 0),
        0
      );
      const totalBuy = results.reduce(
        (sum, r) =>
          sum +
          (r.buyPricePerCaseUsd || 0) *
            (poItems.find((p) => p.id === r.itemId)?.quantity || 0),
        0
      );
      const totalProfit = totalSell - totalBuy;
      const overallMargin = totalSell > 0 ? (totalProfit / totalSell) * 100 : 0;

      await db
        .update(sourceCustomerPos)
        .set({
          status: 'matched',
          matchedAt: new Date(),
          totalSellPriceUsd: Math.round(totalSell * 100) / 100,
          totalBuyPriceUsd: Math.round(totalBuy * 100) / 100,
          totalProfitUsd: Math.round(totalProfit * 100) / 100,
          profitMarginPercent: Math.round(overallMargin * 100) / 100,
          losingItemCount: losingCount,
        })
        .where(eq(sourceCustomerPos.id, input.customerPoId));

      // Notify distributor that their PO has been received and is being processed
      void notifyDistributorOfCustomerPoReceived({
        customerPoId: input.customerPoId,
      });

      return {
        results,
        summary: {
          totalItems: poItems.length,
          matchedItems: matchedCount,
          unmatchedItems: poItems.length - matchedCount,
          losingItems: losingCount,
          totalSellUsd: Math.round(totalSell * 100) / 100,
          totalBuyUsd: Math.round(totalBuy * 100) / 100,
          totalProfitUsd: Math.round(totalProfit * 100) / 100,
          profitMarginPercent: Math.round(overallMargin * 100) / 100,
        },
      };
    } catch (error) {
      logger.error('Error auto-matching customer PO:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to auto-match items. Please try again.',
      });
    }
  });

export default adminAutoMatchCustomerPo;
