import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsQuoteLineItems,
  logisticsQuoteRequests,
  logisticsQuotes,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getUaeArrivalRateCard from '../data/getUaeArrivalRateCard';
import quoteAllInPrices from '../utils/quoteAllInPrices';
import quoteTotalUsd from '../utils/quoteTotalUsd';
import requestUnitCounts from '../utils/requestUnitCounts';
import uaeArrivalCharge from '../utils/uaeArrivalCharge';

const compareQuotesSchema = z.object({
  quoteIds: z.array(z.string().uuid()).min(2).max(5),
});

/**
 * Compare multiple freight quotes side by side
 *
 * Returns detailed quote data for comparison, including line items and computed
 * comparison metrics.
 */
const adminCompareQuotes = adminProcedure
  .input(compareQuotesSchema)
  .query(async ({ input }) => {
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

    // Quotes answering one request price per bottle and per 75cl of its cargo
    const requestIds = [
      ...new Set(
        quotes.map((q) => q.requestId).filter((id): id is string => !!id),
      ),
    ];
    const requests = requestIds.length
      ? await db
          .select({
            id: logisticsQuoteRequests.id,
            totalBottles: logisticsQuoteRequests.totalBottles,
            total75clEquivalents: logisticsQuoteRequests.total75clEquivalents,
            destinationCountry: logisticsQuoteRequests.destinationCountry,
            transportMode: logisticsQuoteRequests.transportMode,
            shipmentBottles: logisticsShipments.totalBottles,
          })
          .from(logisticsQuoteRequests)
          .leftJoin(
            logisticsShipments,
            eq(logisticsShipments.id, logisticsQuoteRequests.shipmentId),
          )
          .where(inArray(logisticsQuoteRequests.id, requestIds))
      : [];

    const rateCard = await getUaeArrivalRateCard();

    // Build comparison data, every total also in USD so currencies compare
    const quotesWithItems = quotes.map((quote) => {
      const request = requests.find((r) => r.id === quote.requestId);
      const counts = request
        ? requestUnitCounts(request, request.shipmentBottles)
        : null;
      const items = lineItemsByQuote.get(quote.id) || [];
      const arrival = uaeArrivalCharge(
        rateCard,
        request ?? quote,
        items.map((i) => i.category),
      );

      return {
        ...quote,
        ...quoteAllInPrices(quoteTotalUsd(quote), arrival, {
          bottles: counts?.bottles ?? null,
          equivalents: counts?.equivalents ?? null,
        }),
        lineItems: items,
      };
    });

    // Metrics are in USD when every quote converts; otherwise in the quotes' own figures, flagged
    const everyInUsd = quotesWithItems.every((q) => q.totalUsd != null);
    const priceOf = (q: (typeof quotesWithItems)[number]) =>
      everyInUsd ? q.allInUsd! : q.totalPrice;
    const prices = quotesWithItems.map(priceOf);
    const transitDays = quotes
      .map((q) => q.transitDays)
      .filter((d): d is number => d !== null);

    const comparison = {
      currency: everyInUsd ? 'USD' : null,
      lowestPrice: Math.min(...prices),
      highestPrice: Math.max(...prices),
      averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      priceDifference: Math.max(...prices) - Math.min(...prices),
      fastestTransit: transitDays.length > 0 ? Math.min(...transitDays) : null,
      slowestTransit: transitDays.length > 0 ? Math.max(...transitDays) : null,
      lowestPriceQuoteId: quotesWithItems.find(
        (q) => priceOf(q) === Math.min(...prices),
      )?.id,
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
      Array<{
        quoteId: string;
        forwarder: string;
        /** In the quote's own currency */
        amount: number | null;
        currency: string;
        /** The same amount in USD at the quote's rate, for ranking across currencies */
        amountUsd: number | null;
      }>
    > = {};

    for (const category of allCategories) {
      categoryComparison[category] = quotesWithItems.map((quote) => {
        const categoryItems = quote.lineItems.filter(
          (item) => item.category === category,
        );
        const totalForCategory =
          categoryItems.length > 0
            ? categoryItems.reduce((sum, item) => sum + item.total, 0)
            : null;

        const rate = quote.currency.toUpperCase() === 'USD' ? 1 : quote.fxToUsd;

        return {
          quoteId: quote.id,
          forwarder: quote.forwarderName,
          amount: totalForCategory,
          currency: quote.currency,
          amountUsd:
            totalForCategory != null && rate ? Math.round(totalForCategory * rate * 100) / 100 : null,
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
