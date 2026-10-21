const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Price a freight quote per bottle and per 75cl equivalent
 *
 * Quotes for the same cargo rank on the per-75cl figure, so a load heavy in
 * magnums is not made to look cheap per bottle. Each figure is null when its
 * count is missing or zero, rather than a division nobody can check.
 *
 * @example
 *   quoteUnitPrices(2140, 993, 1111.3); // { perBottleUsd: 2.16, per75clUsd: 1.93 }
 *
 * @param totalUsd - The quote total in USD, or null when it cannot be converted
 * @param bottles - Bottles on the request
 * @param equivalents - 75cl equivalents on the request
 * @returns USD per bottle and per 75cl equivalent
 */
const quoteUnitPrices = (
  totalUsd: number | null,
  bottles: number | null,
  equivalents: number | null,
) => ({
  perBottleUsd: totalUsd != null && bottles ? round2(totalUsd / bottles) : null,
  per75clUsd: totalUsd != null && equivalents ? round2(totalUsd / equivalents) : null,
});

export default quoteUnitPrices;
