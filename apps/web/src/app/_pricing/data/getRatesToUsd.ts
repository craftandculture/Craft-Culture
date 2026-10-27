import { TRPCError } from '@trpc/server';

import exchangeRateService, {
  type SupportedCurrency,
} from '@/lib/currency/exchangeRateService';
import logger from '@/utils/logger';

import { getPricingConfig } from './getPricingConfig';

const CACHE_TTL_MS = 60 * 60 * 1000;

const liveCache = new Map<string, { rate: number; at: number }>();

/**
 * Look up the most recent ECB rate to USD within the last week
 *
 * A one-day lookup fails at weekends and on bank holidays, so the window is a
 * week and the latest observation wins.
 */
const fetchLiveRate = async (currency: string) => {
  const cached = liveCache.get(currency);

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.rate;

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const result = await exchangeRateService.getExchangeRates(
    currency as SupportedCurrency,
    'USD',
    weekAgo,
    today,
  );

  const sorted = [...result.rates].sort((a, b) => a.date.localeCompare(b.date));
  const rate = sorted[sorted.length - 1]?.rate;

  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No ECB rate returned for ${currency}`);
  }

  liveCache.set(currency, { rate, at: Date.now() });

  return rate;
};

/**
 * Resolve a rate to USD for each offer currency
 *
 * Order of preference: USD is 1, then the live ECB rate, then the rate stored
 * in Pricing Settings (exchange_rates module, e.g. `gbp_to_usd`). A currency
 * with neither is refused rather than priced at 1 — a GBP cost read as USD
 * quotes a wine about a fifth under cost.
 *
 * @example
 *   const rates = await getRatesToUsd(['GBP', 'EUR']);
 *   rates.get('GBP'); // 1.27
 *
 * @param currencies - Currency codes as stored on the offers
 * @returns Map of currency code to USD multiplier
 * @throws TRPCError PRECONDITION_FAILED when a currency has no usable rate
 */
const getRatesToUsd = async (currencies: string[]) => {
  const unique = [
    ...new Set(currencies.map((c) => (c || 'USD').toUpperCase())),
  ];
  const rates = new Map<string, number>();
  const missing: string[] = [];

  let stored: Record<string, number> | undefined;

  for (const currency of unique) {
    if (currency === 'USD') {
      rates.set(currency, 1);
      continue;
    }

    try {
      rates.set(currency, await fetchLiveRate(currency));
      continue;
    } catch (error) {
      logger.warn('Live exchange rate unavailable, using stored rate', {
        currency,
        error,
      });
    }

    stored ??= await getPricingConfig('exchange_rates');

    const storedRate = stored[`${currency.toLowerCase()}_to_usd`];

    if (
      typeof storedRate === 'number' &&
      Number.isFinite(storedRate) &&
      storedRate > 0
    ) {
      rates.set(currency, storedRate);
    } else {
      missing.push(currency);
    }
  }

  if (missing.length > 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `No exchange rate available for ${missing.join(', ')}. Please try again shortly.`,
    });
  }

  return rates;
};

/** Read a resolved rate for one currency (USD when blank) */
export const rateFor = (rates: Map<string, number>, currency: string) => {
  const rate = rates.get((currency || 'USD').toUpperCase());

  if (rate === undefined) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `No exchange rate available for ${currency}`,
    });
  }

  return rate;
};

export default getRatesToUsd;
