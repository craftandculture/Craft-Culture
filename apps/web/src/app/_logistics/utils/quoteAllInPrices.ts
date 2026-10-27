import quoteUnitPrices from './quoteUnitPrices';
import type uaeArrivalCharge from './uaeArrivalCharge';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A quote's true cost: the forwarder's total plus UAE arrival charges
 *
 * `perBottleUsd` and `per75clUsd` are all-in, so quotes rank and the client is
 * priced on what a bottle really costs to land. The forwarder's own figures
 * stay alongside (`totalUsd`, `freightPerBottleUsd`), since that is what the
 * forwarder is paid and what reaches the job when the quote is accepted.
 *
 * @example
 *   quoteAllInPrices(4245, { usd: 555.49, aed: 2040, coveredByQuote: [] }, { bottles: 522, equivalents: 522 });
 *
 * @param totalUsd - The forwarder's total in USD, or null when it cannot be converted
 * @param arrival - The UAE arrival charge, or null outside the UAE
 * @param counts - Bottles and 75cl equivalents on the request
 * @returns All-in total and unit prices, with the freight and arrival parts
 */
const quoteAllInPrices = (
  totalUsd: number | null,
  arrival: ReturnType<typeof uaeArrivalCharge>,
  counts: { bottles: number | null; equivalents: number | null },
) => {
  const allInUsd = totalUsd != null ? round2(totalUsd + (arrival?.usd ?? 0)) : null;

  return {
    totalUsd,
    allInUsd,
    arrivalUsd: arrival?.usd ?? null,
    arrivalCoveredByQuote: arrival?.coveredByQuote ?? [],
    freightPerBottleUsd: quoteUnitPrices(totalUsd, counts.bottles, counts.equivalents).perBottleUsd,
    arrivalPerBottleUsd: quoteUnitPrices(arrival?.usd ?? null, counts.bottles, counts.equivalents).perBottleUsd,
    ...quoteUnitPrices(allInUsd, counts.bottles, counts.equivalents),
  };
};

export default quoteAllInPrices;
