/**
 * How many bottles a PCO line is for
 *
 * A line is counted in the pack sold: whole cases of their case size, and a
 * single bottle as a pack of one. A line with no pack recorded is a case of
 * twelve, the column's default and the rule the sales order uses.
 *
 * @example
 *   pcoLineBottles({ quantity: 2, caseConfig: 6 }); // 12
 *   pcoLineBottles({ quantity: 3, caseConfig: 1 }); // 3
 *
 * @param line - The line's quantity and pack
 * @returns The bottles on the line
 */
const pcoLineBottles = (line: {
  quantity: number;
  caseConfig: number | null | undefined;
}) => {
  const pack = line.caseConfig && line.caseConfig > 0 ? line.caseConfig : 12;

  return Math.max(0, line.quantity) * pack;
};

export default pcoLineBottles;
