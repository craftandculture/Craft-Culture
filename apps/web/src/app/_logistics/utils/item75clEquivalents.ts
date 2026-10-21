import itemBottles from './itemBottles';
import type { BottleCountable } from './itemBottles';

/**
 * Count a line in 75cl-equivalent bottles
 *
 * A 1500ml magnum counts 2, a 3000ml counts 4, a 37.5cl half counts 0.5.
 * Freight is shared and compared on this, so large formats carry their fair
 * share and a quote reads the same whatever the mix of sizes.
 *
 * @example
 *   item75clEquivalents({ totalBottles: 6, cases: 1, bottlesPerCase: 6, bottleSizeMl: 1500 }); // 12
 *
 * @param item - The line to count, with its bottle size in millilitres
 * @returns The number of 75cl equivalents
 */
const item75clEquivalents = (item: BottleCountable & { bottleSizeMl: number | null }) =>
  itemBottles(item) * ((item.bottleSizeMl ?? 750) / 750);

export default item75clEquivalents;
