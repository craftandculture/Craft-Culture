/**
 * How a release line is written onto its private client order
 *
 * A PCO line's quantity is counted in the pack it is sold in, and a single
 * bottle is a pack of one. A release line knows bottles and the pack the
 * member holds them in, so the two have to be reconciled: writing the bottles
 * as the quantity against the held pack turned one bottle of a 6-pack into
 * one case of six on the Zoho order and on the pick.
 *
 * Whole cases go out as cases; anything that does not divide evenly goes out
 * as bottles, which is always the honest count.
 *
 * @example
 *   releaseLineQuantity({ bottles: 12, caseConfig: 6 }); // { caseConfig: 6, quantity: 2 }
 *   releaseLineQuantity({ bottles: 1, caseConfig: 6 }); // { caseConfig: 1, quantity: 1 }
 *   releaseLineQuantity({ bottles: 3, caseConfig: null }); // { caseConfig: 1, quantity: 3 }
 *
 * @param line.bottles - Bottles being released
 * @param line.caseConfig - Bottles per case the member holds them in, if known
 * @returns The pack and quantity for the order line
 */
const releaseLineQuantity = ({
  bottles,
  caseConfig,
}: {
  bottles: number;
  caseConfig: number | null | undefined;
}) => {
  const pack = caseConfig ?? 1;

  if (pack > 1 && bottles % pack === 0) {
    return { caseConfig: pack, quantity: bottles / pack };
  }

  return { caseConfig: 1, quantity: bottles };
};

export default releaseLineQuantity;
