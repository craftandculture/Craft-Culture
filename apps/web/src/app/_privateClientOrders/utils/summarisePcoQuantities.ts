import describePcoLine from './describePcoLine';

/**
 * An order's size in one line: "6 bottles", or "2 cases + 3 bottles · 15 btl"
 *
 * The stored case count adds single bottles to cases as if they were the same
 * thing, so an order of six singles read "6 cases". This counts cases and
 * single bottles apart and always ends on the bottle total, which is what a
 * client and a driver both count.
 *
 * @param items - The order's lines
 * @returns The summary to show beside the order total
 */
const summarisePcoQuantities = (
  items: Array<{
    quantity: number;
    caseConfig?: number | null;
    bottleSize?: string | null;
  }>,
) => {
  let cases = 0;
  let singles = 0;
  let bottles = 0;

  for (const item of items) {
    const line = describePcoLine(item);
    bottles += line.bottles;
    if (line.isSingle) singles += item.quantity;
    else cases += item.quantity;
  }

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  if (cases === 0) return plural(bottles, 'bottle');
  if (singles === 0) return `${plural(cases, 'case')} · ${bottles} btl`;
  return `${plural(cases, 'case')} + ${plural(singles, 'bottle')} · ${bottles} btl`;
};

export default summarisePcoQuantities;
