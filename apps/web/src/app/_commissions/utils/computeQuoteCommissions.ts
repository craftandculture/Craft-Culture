import { getPricingConfig } from '@/app/_pricing/data/getPricingConfig';
import db from '@/database/client';
import exchangeRateService, {
  type SupportedCurrency,
} from '@/lib/currency/exchangeRateService';
import logger from '@/utils/logger';

/** Commission on a B2C quote: 5% of the base price per case, as quoted */
const COMMISSION_RATE = 0.05;

export interface QuoteForCommission {
  id: string;
  lineItems: unknown;
  quoteData: unknown;
}

export interface QuoteCommission {
  /** The commission to show and pay */
  commissionUsd: number;
  /**
   * False when some line could not be priced from the catalogue (offer gone, or
   * no exchange rate), so the figure may be short and needs a check
   */
  verified: boolean;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The commission earned on each quote, worked out on the server
 *
 * The figure stored on a quote (`quoteData.totalCommissionUsd`) is sent by the
 * browser that saved it, so anyone could raise their own commission by sending
 * a bigger number. Here it is recalculated from the quote's lines and the
 * catalogue: each line's offer price in USD, with C&C's B2B margin, at 5% per
 * case. The stored figure is used only as a ceiling, so a price that has risen
 * since the quote never pays more than was quoted, and an edited figure never
 * pays more than the lines support.
 *
 * @example
 *   const commissions = await computeQuoteCommissions(rows);
 *   commissions.get(quote.id)?.commissionUsd;
 *
 * @param quotes - The quotes, with their saved lines and quote data
 * @returns Each quote's commission by quote id
 */
const computeQuoteCommissions = async (quotes: QuoteForCommission[]) => {
  const result = new Map<string, QuoteCommission>();
  if (quotes.length === 0) return result;

  const linesOf = (quote: QuoteForCommission) =>
    (Array.isArray(quote.lineItems) ? quote.lineItems : [])
      .map((line) => line as { offerId?: unknown; quantity?: unknown })
      .filter(
        (line): line is { offerId: string; quantity: number } =>
          typeof line.offerId === 'string' &&
          typeof line.quantity === 'number' &&
          Number.isFinite(line.quantity) &&
          line.quantity > 0,
      );

  const offerIds = [
    ...new Set(
      quotes.flatMap((quote) => linesOf(quote).map((line) => line.offerId)),
    ),
  ];

  const [b2bConfig, offers] = await Promise.all([
    getPricingConfig('b2b'),
    offerIds.length > 0
      ? db.query.productOffers.findMany({
          where: { id: { in: offerIds } },
          columns: { id: true, price: true, currency: true },
        })
      : Promise.resolve([]),
  ]);

  const ccMarginPercent = Number(b2bConfig.cc_margin_percent ?? 0);
  const marginMultiplier =
    ccMarginPercent < 100 ? 1 / (1 - ccMarginPercent / 100) : 0;

  // ECB rates are published a day behind
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // A rate that cannot be fetched is left out, never guessed as 1
  const rates = new Map<string, number | null>([['USD', 1]]);
  for (const currency of new Set(offers.map((offer) => offer.currency))) {
    if (rates.has(currency)) continue;
    try {
      const rate = await exchangeRateService.getExchangeRate(
        currency as SupportedCurrency,
        'USD',
        yesterday,
      );
      rates.set(currency, Number.isFinite(rate) && rate > 0 ? rate : null);
    } catch (error) {
      logger.warn('Commission: exchange rate unavailable', {
        currency,
        error: error instanceof Error ? error.message : String(error),
      });
      rates.set(currency, null);
    }
  }

  const offerById = new Map(offers.map((offer) => [offer.id, offer]));

  for (const quote of quotes) {
    let recomputed = 0;
    let verified = true;

    for (const line of linesOf(quote)) {
      const offer = offerById.get(line.offerId);
      const rate = offer ? rates.get(offer.currency) : null;

      if (!offer || !rate) {
        verified = false;
        continue;
      }

      // The same base price the quote showed: price in USD with C&C's margin
      const basePriceUsd = round2(offer.price * rate * marginMultiplier);
      recomputed += round2(basePriceUsd * COMMISSION_RATE * line.quantity);
    }

    const stored = (quote.quoteData as { totalCommissionUsd?: unknown } | null)
      ?.totalCommissionUsd;
    const storedUsd =
      typeof stored === 'number' && Number.isFinite(stored) && stored >= 0
        ? stored
        : null;

    result.set(quote.id, {
      commissionUsd: round2(
        storedUsd === null ? recomputed : Math.min(storedUsd, recomputed),
      ),
      verified,
    });
  }

  return result;
};

export default computeQuoteCommissions;
