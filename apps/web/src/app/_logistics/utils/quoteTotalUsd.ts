import { PEGGED } from './resolveFxToUsd';

/**
 * A quote's total in USD, for ranking
 *
 * Uses the figure stored when the quote was saved. A quote saved before that
 * was recorded converts here only when its currency is the dollar or pegged
 * to it; anything else returns null rather than a guessed rate.
 *
 * @example
 *   quoteTotalUsd({ totalUsd: null, totalPrice: 1000, currency: 'AED' }); // 272.3
 *
 * @param quote - The quote's stored USD total, its own total and currency
 * @returns The total in USD, or null when it cannot be known without a rate lookup
 */
const quoteTotalUsd = (quote: { totalUsd: number | null; totalPrice: number; currency: string }) => {
  if (quote.totalUsd != null) return quote.totalUsd;

  const rate = PEGGED[(quote.currency || 'USD').toUpperCase()];

  return rate == null ? null : Math.round(quote.totalPrice * rate * 100) / 100;
};

export default quoteTotalUsd;
