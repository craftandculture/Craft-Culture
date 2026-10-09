/**
 * Whether a cycle count line has nothing to count
 *
 * True for a line that expects no cases, has not been counted, and whose stock
 * row holds no loose bottles. Shared by the count screen, which hides these
 * lines, and by completion, which records them as zero, so the two can never
 * disagree about which lines the operator was spared.
 *
 * @example
 *   isEmptyUncounted({ expectedQuantity: 0, countedQuantity: null, openBottles: 0 }); // true
 *
 * @param line - The line's expected and counted cases, and its stock's loose bottles
 * @returns True when the line can be left out of the count
 */
const isEmptyUncounted = (line: {
  expectedQuantity: number;
  countedQuantity: number | null;
  openBottles: number | null;
}) =>
  line.expectedQuantity === 0 &&
  line.countedQuantity === null &&
  !(line.openBottles && line.openBottles > 0);

export default isEmptyUncounted;
