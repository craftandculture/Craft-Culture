/** USD-pegged currencies convert at a fixed rate rather than a lookup. */
export const PEGGED: Record<string, number> = {
  USD: 1,
  AED: 0.2723,
  SAR: 0.2667,
  QAR: 0.2747,
  BHD: 2.6539,
  OMR: 2.6008,
};

export interface FxResult {
  /** Multiply a source-currency amount by this to get USD */
  rate: number;
  /** Where the rate came from, so a converted figure stays explainable */
  source: 'usd' | 'pegged' | 'live' | 'agreed' | 'unresolved';
}

const cache = new Map<string, number>();

/**
 * Find today's rate from a currency to USD
 *
 * Pegged currencies are fixed and need no lookup. Everything else is asked of
 * a rate service, and a currency that cannot be resolved returns 1 marked
 * `unresolved` rather than a guess — a wrong rate applied silently to 163
 * lines is worse than a conversion that visibly did not happen.
 *
 * Deliberately not asked of the extraction model. It will happily return a
 * plausible rate, and one did: this shipment's euro prices arrived already
 * multiplied by about 1.1666, with nothing recording that a conversion had
 * taken place or at what rate. A number nobody chose is not a number anybody
 * can check.
 *
 * @param currency - ISO code from the document
 * @returns The rate to USD and where it came from
 */
const resolveFxToUsd = async (currency: string): Promise<FxResult> => {
  const code = (currency || 'USD').toUpperCase();

  if (code === 'USD') return { rate: 1, source: 'usd' };
  if (PEGGED[code] != null) return { rate: PEGGED[code], source: 'pegged' };

  const cached = cache.get(code);

  if (cached) return { rate: cached, source: 'live' };

  try {
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${encodeURIComponent(code)}`,
    );

    if (response.ok) {
      const data = (await response.json()) as { rates?: Record<string, number> };
      const rate = data.rates?.USD;

      if (typeof rate === 'number' && rate > 0) {
        cache.set(code, rate);

        return { rate, source: 'live' };
      }
    }
  } catch {
    // A lookup that fails leaves the amounts in their own currency, which the
    // items screen shows as unconverted rather than quietly wrong.
  }

  return { rate: 1, source: 'unresolved' };
};

export default resolveFxToUsd;
