/**
 * Generate a unique barcode for a case label
 * Format: CASE-{LWIN18}-{SEQ} where SEQ is a 3-digit sequence
 *
 * @example
 *   generateCaseLabelBarcode('1010279-2015-06-00750', 1); // returns 'CASE-1010279-2015-06-00750-001'
 *   generateCaseLabelBarcode('1010279-2015-06-00750', 42); // returns 'CASE-1010279-2015-06-00750-042'
 *
 * @param lwin18 - The LWIN-18 code for the product
 * @param sequence - The sequence number for this case within the shipment
 * @returns The generated case barcode
 */
const generateCaseLabelBarcode = (lwin18: string, sequence: number) => {
  return `CASE-${lwin18}-${sequence.toString().padStart(3, '0')}`;
};

export default generateCaseLabelBarcode;
