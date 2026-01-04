import { getPricingConfig } from '@/app/_pricing/data/getPricingConfig';
import db from '@/database/client';
import exchangeRateService, {
  type SupportedCurrency,
} from '@/lib/currency/exchangeRateService';
import { protectedProcedure } from '@/lib/trpc/procedures';

import getQuoteRequestSchema from '../schemas/getQuoteRequestSchema';

interface QuoteLineItem {
  productId: string;
  lineItemTotalUsd: number;
  commissionUsd: number;
  basePriceUsd: number;
}

interface QuoteData {
  lineItems: QuoteLineItem[];
  totalUsd: number;
  totalCommissionUsd: number;
  subtotalBeforeCommissionUsd: number;
}

const quotesGet = protectedProcedure
  .input(getQuoteRequestSchema)
  .query(async ({ input: { lineItems }, ctx: { user } }) => {
    const offerIds = lineItems.map((item) => item.offerId);

    // Parallelize database queries
    const [b2bConfig, offers] = await Promise.all([
      // Get B2B pricing config
      getPricingConfig('b2b'),
      // Fetch all the offers for the line items
      db.query.productOffers.findMany({
        where: {
          id: {
            in: offerIds,
          },
        },
        with: {
          product: true,
        },
      }),
    ]);

    const ccMarginPercent = b2bConfig.cc_margin_percent ?? 0;
    const marginMultiplier = 1 / (1 - ccMarginPercent / 100);

    // Fetch exchange rates for all unique currencies in parallel
    const uniqueCurrencies = [
      ...new Set(offers.map((offer) => offer.currency)),
    ] as SupportedCurrency[];

    // Use yesterday's date to ensure data is available (ECB updates with 1 day delay)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const exchangeRatePromises = uniqueCurrencies.map(
      (currency) =>
        exchangeRateService
          .getExchangeRate(currency, 'USD', yesterday)
          .catch(() => 1), // Default to 1 if fetch fails
    );

    const exchangeRates = await Promise.all(exchangeRatePromises);

    // Create a map of currency to exchange rate
    const exchangeRateMap = new Map(
      uniqueCurrencies.map((currency, index) => [
        currency,
        exchangeRates[index] ?? 1,
      ]),
    );

    // Calculate quote using new B2B pricing config
    const quoteLineItems: QuoteLineItem[] = lineItems.map((lineItem) => {
      const offer = offers.find((o) => o.id === lineItem.offerId);

      if (!offer) {
        return {
          productId: '',
          lineItemTotalUsd: 0,
          commissionUsd: 0,
          basePriceUsd: 0,
        };
      }

      const exchangeRate = exchangeRateMap.get(offer.currency as SupportedCurrency) ?? 1;

      // Calculate base price: raw price * exchange rate * margin multiplier
      const basePriceUsd =
        Math.round(offer.price * exchangeRate * marginMultiplier * 100) / 100;

      // Line item total = base price * quantity
      const lineItemTotalUsd =
        Math.round(basePriceUsd * lineItem.quantity * 100) / 100;

      // Calculate commission: 5% of base price per case × quantity (B2C only)
      const commissionPerCase = basePriceUsd * 0.05;
      const commissionUsd =
        user.customerType === 'b2c'
          ? Math.round(commissionPerCase * lineItem.quantity * 100) / 100
          : 0;

      return {
        productId: offer.productId,
        lineItemTotalUsd,
        commissionUsd,
        basePriceUsd,
      };
    });

    // Calculate totals
    const totalCommissionUsd = quoteLineItems.reduce(
      (sum, item) => sum + item.commissionUsd,
      0,
    );

    const totalUsd = quoteLineItems.reduce(
      (sum, item) => sum + item.lineItemTotalUsd,
      0,
    );

    const subtotalBeforeCommissionUsd = totalUsd - totalCommissionUsd;

    const quoteData: QuoteData = {
      lineItems: quoteLineItems,
      totalUsd: Math.round(totalUsd * 100) / 100,
      totalCommissionUsd: Math.round(totalCommissionUsd * 100) / 100,
      subtotalBeforeCommissionUsd:
        Math.round(subtotalBeforeCommissionUsd * 100) / 100,
    };

    return quoteData;
  });

export default quotesGet;
