import { calculateQuote } from '@/app/_pricingModels/utils/calculateQuote';
import db from '@/database/client';
import exchangeRateService, {
  type SupportedCurrency,
} from '@/lib/currency/exchangeRateService';
import { protectedProcedure } from '@/lib/trpc/procedures';

import getQuoteRequestSchema from '../schemas/getQuoteRequestSchema';

const quotesGet = protectedProcedure
  .input(getQuoteRequestSchema)
  .query(async ({ input: { lineItems }, ctx: { user } }) => {
    const offerIds = lineItems.map((item) => item.offerId);

    // Parallelize database queries
    const [pricingModel, offers] = await Promise.all([
      // Get the user's pricing model, or use the default based on their customer type
      db.query.pricingModels.findFirst({
        where: user.pricingModelId
          ? { id: user.pricingModelId }
          : user.customerType === 'b2c'
            ? { isDefaultB2C: true }
            : { isDefaultB2B: true },
        with: {
          sheet: true,
        },
      }),
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

    if (!pricingModel) {
      throw new Error('No pricing model found');
    }

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

    // Calculate quote using the pricing model
    const quoteData = calculateQuote(
      lineItems,
      offers,
      pricingModel.cellMappings,
      pricingModel.sheet.formulaData as Record<string, unknown>,
      user.customerType,
      exchangeRateMap,
    );

    return quoteData;
  });

export default quotesGet;
