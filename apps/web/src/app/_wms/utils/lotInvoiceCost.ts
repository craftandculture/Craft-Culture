/**
 * The cost a stock lot was invoiced at, when the invoice line is its own
 *
 * An own invoice line beats a typed import price (see lotShipmentCost). A
 * stand-in line (the latest line for the wine elsewhere) returns null, so a
 * typed price can still fill in for old stock and repacks.
 *
 * The Pricing Manager rows, its KPI tiles and the import-price save all ask
 * this, so the cell that is locked is exactly the cell whose typed price
 * would be ignored.
 *
 * @example
 *   lotInvoiceCost({ ownLine: true, productCost: 1213 }); // 1213
 *   lotInvoiceCost({ ownLine: false, productCost: 1213 }); // null
 */
const lotInvoiceCost = (lot: {
  ownLine: boolean | null | undefined;
  productCost: number | null | undefined;
}) =>
  lot.ownLine && lot.productCost != null && lot.productCost > 0 ? lot.productCost : null;

export default lotInvoiceCost;
