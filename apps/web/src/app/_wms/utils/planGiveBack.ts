interface StockCounts {
  quantityCases: number;
  reservedCases: number;
  availableCases: number;
}

/**
 * The counts a stock row should carry once a released hold gives its cases back
 *
 * Reserved comes down by the hold, never below nothing, and available goes up
 * by the hold but never past what is on the shelf less what is still held.
 * The cap is the point: a hold whose cases a pick has already taken (the pick
 * and a release crossing, 5 Nov) used to add a case back to available on a row
 * with nothing on it, and the price lists offered it. giveBackHeldCases runs
 * the same arithmetic in SQL; this is the one written out to be tested.
 *
 * @example
 *   planGiveBack({ quantityCases: 0, reservedCases: 0, availableCases: 0 }, 1);
 *   // { quantityCases: 0, reservedCases: 0, availableCases: 0 }, not available 1
 *
 * @param row - The row's counts before the give-back
 * @param cases - The size of the hold being released
 * @returns The row's counts after it
 */
const planGiveBack = (row: StockCounts, cases: number): StockCounts => {
  const reservedCases = Math.max(row.reservedCases - cases, 0);
  return {
    quantityCases: row.quantityCases,
    reservedCases,
    availableCases: Math.min(row.availableCases + cases, Math.max(row.quantityCases - reservedCases, 0)),
  };
};

export default planGiveBack;
