/** The quantity fields every shipment or request line carries */
export interface BottleCountable {
  totalBottles: number | null;
  cases: number;
  bottlesPerCase: number | null;
}

/**
 * Count the bottles on a line
 *
 * The line's own bottle count wins; without one it is cases × bottles per
 * case, taking a case as 12 when the pack is unknown.
 *
 * @example
 *   itemBottles({ totalBottles: null, cases: 3, bottlesPerCase: 6 }); // 18
 *
 * @param item - The line to count
 * @returns The number of bottles
 */
const itemBottles = (item: BottleCountable) =>
  item.totalBottles ?? item.cases * (item.bottlesPerCase ?? 12);

export default itemBottles;
