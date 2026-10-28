import CELLAR_CURRENCIES from '@/app/_cellar/constants/cellarCurrencies';
import type { CellarCurrency } from '@/app/_cellar/constants/cellarCurrencies';
import resolveFxToUsd from '@/app/_logistics/utils/resolveFxToUsd';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * Today's rates for the currencies a member can price in, as USD per unit
 *
 * The same lookup an offer is converted with, so the figure a member sees
 * while setting a price is the one the offer records. AED is pegged; EUR and
 * GBP are today's market rate. A rate that cannot be found is left out
 * rather than guessed, and the screen offers USD only for it.
 *
 * @example
 *   const { rates } = await trpcClient.consignment.member.getFxRates.query();
 *   rates.EUR; // 1.1203 — €1 is $1.1203
 */
const memberGetFxRates = stockOwnerProcedure.query(async () => {
  const resolved = await Promise.all(
    CELLAR_CURRENCIES.map(async (code) => [code, await resolveFxToUsd(code)] as const),
  );

  const rates: Partial<Record<CellarCurrency, number>> = {};
  for (const [code, fx] of resolved) {
    if (fx.source !== 'unresolved' && fx.rate > 0) rates[code] = fx.rate;
  }

  return { rates, asOf: new Date() };
});

export default memberGetFxRates;
