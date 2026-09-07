import parseLpoText from './parseLpoText';
import type { ParsedLpo } from './parseLpoText';
import parseOrderFormText, { isOrderForm } from './parseOrderFormText';
import parseProformaText, { isProforma } from './parseProformaText';

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
const parseAnyLpoText = (text: string): ParsedLpo => {
  if (isOrderForm(text)) return parseOrderFormText(text);

  // A proforma we issued is an order too, and reads nothing like a client's.
  if (isProforma(text)) return parseProformaText(text);

  return parseLpoText(text);
};

export default parseAnyLpoText;
