/**
 * What is free on the shelf, in the words of how it is packed
 *
 * Stock counts the units it is held in. For single bottles that unit is a
 * bottle, and "2 cs available" told the person ordering there were two cases
 * when there were two bottles. Cases also say how many bottles they come to,
 * because an order for loose bottles is filled from them.
 *
 * @example
 *   describeAvailableStock(2, 1); // '2 btl available'
 *   describeAvailableStock(3, 6); // '3 cs available · 18 btl'
 *
 * @param cases - Units available, as the stock row counts them
 * @param caseConfig - Bottles per unit on that stock row
 * @returns The label for the stock badge
 */
const describeAvailableStock = (
  cases: number,
  caseConfig: number | null | undefined,
) => {
  const pack = caseConfig && caseConfig > 0 ? caseConfig : 1;
  if (pack === 1) return `${cases} btl available`;
  return `${cases} cs available · ${cases * pack} btl`;
};

export default describeAvailableStock;
