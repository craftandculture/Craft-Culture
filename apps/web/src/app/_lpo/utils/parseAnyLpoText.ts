import parseLpoText from './parseLpoText';
import type { ParsedLpo } from './parseLpoText';
import parseOrderFormText, { isOrderForm } from './parseOrderFormText';

/**
 * Read a purchase-order PDF, whichever of the layouts it happens to be.
 *
 * Clients do not share a template. The choice is made on what the document
 * says about itself rather than on which parser returns more lines, so a
 * layout that half-reads under the wrong parser cannot quietly win.
 *
 * @param text - Text extracted from the purchase-order PDF
 * @returns The order in the one shape the rest of `_lpo` works in
 */
const parseAnyLpoText = (text: string): ParsedLpo =>
  isOrderForm(text) ? parseOrderFormText(text) : parseLpoText(text);

export default parseAnyLpoText;
