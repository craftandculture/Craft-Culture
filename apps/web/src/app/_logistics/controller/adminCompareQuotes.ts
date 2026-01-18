import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsQuoteLineItems, logisticsQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const compareQuotesSchema = z.object({
  quoteIds: z.array(z.string().uuid()).min(2).max(5),
});

/**
 * Compare multiple freight quotes side by side
 *
 * Returns detailed quote data for comparison, including line items
 * and computed comparison metrics.
 */
const adminCompareQuotes = adminProcedure.input(compareQuotesSchema).query(async ({ input }) => {
  const { quoteIds } = input;

  // Get all quotes
  const quotes = await db
    .select()
    .from(logisticsQuotes)
    .where(inArray(logisticsQuotes.id, quoteIds));

  if (quotes.length !== quoteIds.length) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'One or more quotes not found',
    });
  }

  // Get line items for all quotes
  const lineItems = await db
    .select()
    .from(logisticsQuoteLineItems)
    .where(inArray(logisticsQuoteLineItems.quoteId, quoteIds))
    .orderBy(logisticsQuoteLineItems.sortOrder);

  // Group line items by quote
  const lineItemsByQuote = new Map<string, typeof lineItems>();
  for (const item of lineItems) {
    const existing = lineItemsByQuote.get(item.quoteId) || [];
    existing.push(item);
    lineItemsByQuote.set(item.quoteId, existing);
  }

  // Build comparison data
  const quotesWithItems = quotes.map((quote) => ({
    ...quote,
    lineItems: lineItemsByQuote.get(quote.id) || [],
  }));

  // Calculate comparison metrics
  const prices = quotes.map((q) => q.totalPrice);
  const transitDays = quotes.map((q) => q.transitDays).filter((d): d is number => d !== null);

  const comparison = {
    lowestPrice: Math.min(...prices),
    highestPrice: Math.max(...prices),
    averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
    priceDifference: Math.max(...prices) - Math.min(...prices),
    fastestTransit: transitDays.length > 0 ? Math.min(...transitDays) : null,
    slowestTransit: transitDays.length > 0 ? Math.max(...transitDays) : null,
    lowestPriceQuoteId: quotes.find((q) => q.totalPrice === Math.min(...prices))?.id,
    fastestQuoteId:
      transitDays.length > 0
        ? quotes.find((q) => q.transitDays === Math.min(...transitDays))?.id
        : null,
  };

  // Get all unique cost categories from line items
  const allCategories = new Set<string>();
  for (const items of lineItemsByQuote.values()) {
    for (const item of items) {
      allCategories.add(item.category);
    }
  }

  // Build category comparison
  const categoryComparison: Record<
    string,
    Array<{ quoteId: string; forwarder: string; amount: number | null }>
  > = {};

  for (const category of allCategories) {
    categoryComparison[category] = quotesWithItems.map((quote) => {
      const categoryItems = quote.lineItems.filter((item) => item.category === category);
      const totalForCategory =
        categoryItems.length > 0 ? categoryItems.reduce((sum, item) => sum + item.total, 0) : null;

      return {
        quoteId: quote.id,
        forwarder: quote.forwarderName,
        amount: totalForCategory,
      };
    });
  }

  return {
    quotes: quotesWithItems,
    comparison,
    categoryComparison,
  };
});

export default adminCompareQuotes;
