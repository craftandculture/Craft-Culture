/**
 * Why an import price cannot be typed: the stock's own supplier invoice sets it
 *
 * Shown as the locked cell's tooltip and returned by the server when a save is
 * refused, so both say the same thing.
 *
 * @example
 *   invoicedImportMessage('SHP-2026-0012');
 *   // 'From the supplier invoice on SHP-2026-0012. Use Override, or correct the invoice in Logistics.'
 */
const invoicedImportMessage = (shipmentNumber?: string | null) =>
  `From the supplier invoice${shipmentNumber ? ` on ${shipmentNumber}` : ''}. Use Override, or correct the invoice in Logistics.`;

export default invoicedImportMessage;
