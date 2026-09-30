/**
 * Whether Zoho has billed a sales order far enough for the warehouse to pick it.
 *
 * `partially_invoiced` is let through because an invoice edited after it was
 * raised leaves its sales order there for good. Swapping a line to another pack
 * adds an invoice line with no link back to the order, so that order line reads
 * as never billed and Zoho has no way to mark it done — SO-00155 (Giscours 2017,
 * 12-pack on the order, 6-pack on INV-000365) dropped out of picking this way.
 * The pick is built from the sales order lines, so correct those to match the
 * invoice before releasing; the screen flags these orders so that check is made.
 *
 * Shared by the pick screen, its readiness counts and release-to-pick, so the
 * three can never disagree about which orders are pickable.
 */
const isPickableZohoStatus = (zohoStatus: string | null | undefined) =>
  zohoStatus === 'invoiced' || zohoStatus === 'partially_invoiced';

export default isPickableZohoStatus;
