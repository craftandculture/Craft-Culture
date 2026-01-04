import { TRPCError } from '@trpc/server';

import exchangeRateService from '@/lib/currency/exchangeRateService';
import { DEFAULT_EXCHANGE_RATES } from '@/lib/pricing/defaults';
import type { ExchangeRates } from '@/lib/pricing/types';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Fetch latest exchange rates from ECB
 *
 * Fetches GBP→USD and EUR→USD from the European Central Bank.
 * USD→AED uses a fixed rate (AED is pegged to USD at ~3.67).
 */
const fetchLatestExchangeRates = adminProcedure.mutation(async () => {
  const today = new Date();
  // Look back 7 days to account for weekends/holidays
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  let gbpToUsd = DEFAULT_EXCHANGE_RATES.gbpToUsd;
  let eurToUsd = DEFAULT_EXCHANGE_RATES.eurToUsd;

  try {
    // Fetch GBP → USD rate
    const gbpResult = await exchangeRateService.getExchangeRates('GBP', 'USD', weekAgo, today);

    if (gbpResult.rates.length > 0) {
      // Get the most recent rate
      const latestGbpRate = gbpResult.rates[gbpResult.rates.length - 1];
      if (latestGbpRate) {
        gbpToUsd = Math.round(latestGbpRate.rate * 10000) / 10000;
      }
    }
  } catch (error) {
    console.error('Failed to fetch GBP→USD rate from ECB', { error });
  }

  try {
    // Fetch EUR → USD rate
    const eurResult = await exchangeRateService.getExchangeRates('EUR', 'USD', weekAgo, today);

    if (eurResult.rates.length > 0) {
      // Get the most recent rate
      const latestEurRate = eurResult.rates[eurResult.rates.length - 1];
      if (latestEurRate) {
        eurToUsd = Math.round(latestEurRate.rate * 10000) / 10000;
      }
    }
  } catch (error) {
    console.error('Failed to fetch EUR→USD rate from ECB', { error });
  }

  // AED is pegged to USD, so we use a fixed rate
  // The official peg is 3.6725 but market rates vary slightly
  const usdToAed = DEFAULT_EXCHANGE_RATES.usdToAed;

  if (gbpToUsd === DEFAULT_EXCHANGE_RATES.gbpToUsd && eurToUsd === DEFAULT_EXCHANGE_RATES.eurToUsd) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to fetch exchange rates from ECB. Using default values.',
    });
  }

  const result: ExchangeRates = {
    gbpToUsd,
    eurToUsd,
    usdToAed,
  };

  return result;
});

export default fetchLatestExchangeRates;
