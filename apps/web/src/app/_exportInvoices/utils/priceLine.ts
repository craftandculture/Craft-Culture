import roundMoney from './roundMoney';

/**
 * Price an export line in the document currency
 *
 * The unit is converted and rounded first, and the amount is unit times qty,
 * so the printed row always multiplies out — customs check that before they
 * check anything else. The cost is a few fils of drift against converting the
 * invoice total in one go, which the total check allows for.
 *
 * @example
 *   priceLine(617.71, 1, 3.6725); // { unitPrice: 2268.54, amount: 2268.54 }
 *
 * @param netUsd - What the invoice bills for the whole line, after discount
 * @param qty - Packs on the line
 * @param rate - Document currency per USD
 * @returns The unit price and line amount
 */
const priceLine = (netUsd: number, qty: number, rate: number) => {
  if (qty <= 0) return { unitPrice: 0, amount: 0 };
  const unitPrice = roundMoney((netUsd / qty) * rate);
  return { unitPrice, amount: roundMoney(unitPrice * qty) };
};

export default priceLine;
