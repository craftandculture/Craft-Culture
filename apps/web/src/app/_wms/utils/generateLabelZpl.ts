/**
 * Generate ZPL (Zebra Programming Language) code for a case label
 *
 * Designed for 4" x 2" (100mm x 50mm) direct thermal labels on Zebra ZD421 printer
 * Uses Code 128 barcode for maximum compatibility
 *
 * @example
 *   generateLabelZpl({
 *     barcode: 'CASE-1010279-2015-06-00750-001',
 *     productName: 'Château Margaux 2015',
 *     lwin18: '1010279-2015-06-00750',
 *     packSize: '6x75cl',
 *     lotNumber: '2026-01-31-001',
 *     locationCode: 'A-01-02',
 *   });
 */

export interface LabelData {
  /** Unique case barcode (e.g., CASE-1010279-2015-06-00750-001) */
  barcode: string;
  /** Product name (e.g., Château Margaux 2015) */
  productName: string;
  /** LWIN-18 code */
  lwin18: string;
  /** Pack size (e.g., 6x75cl) */
  packSize: string;
  /** Vintage year (e.g., 2019) */
  vintage?: number | string;
  /** Lot number */
  lotNumber?: string;
  /** Location code where case is stored (e.g., A-01-02) */
  locationCode?: string;
}

/**
 * Split text into two lines if it exceeds max length
 * Returns [line1, line2] - line2 may be empty if text fits on one line
 */
const splitToTwoLines = (str: string, maxCharsPerLine: number): [string, string] => {
  if (str.length <= maxCharsPerLine) {
    return [str, ''];
  }

  // Find a good break point (space) near the middle or max length
  let breakPoint = str.lastIndexOf(' ', maxCharsPerLine);
  if (breakPoint === -1 || breakPoint < maxCharsPerLine / 2) {
    // No good break point, just split at max length
    breakPoint = maxCharsPerLine;
  }

  const line1 = str.slice(0, breakPoint).trim();
  const line2 = str.slice(breakPoint).trim();

  // Truncate line2 if still too long
  if (line2.length > maxCharsPerLine) {
    return [line1, line2.slice(0, maxCharsPerLine - 3) + '...'];
  }

  return [line1, line2];
};

/**
 * Normalize accented characters to ASCII equivalents
 * Handles common wine-related accents (French, Italian, Spanish, German)
 */
const normalizeAccents = (str: string) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/ß/g, 'ss');
};

/**
 * Escape special characters for ZPL
 * ZPL uses ^ as command prefix, so we need to escape it
 * Also normalizes accented characters to ASCII for printer compatibility
 */
const escapeZpl = (str: string) => {
  return normalizeAccents(str).replace(/\^/g, ' ').replace(/~/g, ' ');
};

/**
 * Generate ZPL code for a single case label
 *
 * Professional wine warehouse label layout (4" x 2" at 203 DPI = 812 x 406 dots)
 * Inspired by Cru Wine Limited labels:
 * - Header with company name
 * - Large barcode
 * - Product name (2 lines if needed)
 * - Labeled data fields in clean columns
 */
const generateLabelZpl = (data: LabelData) => {
  const [productLine1, productLine2] = splitToTwoLines(escapeZpl(data.productName), 38);
  const lwin = escapeZpl(data.lwin18);
  const packSize = escapeZpl(data.packSize || '-');
  const vintage = data.vintage ? escapeZpl(String(data.vintage)) : '-';
  const lot = data.lotNumber ? escapeZpl(data.lotNumber) : '-';
  const location = data.locationCode ? escapeZpl(data.locationCode) : '-';

  // ZPL code for 4" x 2" label at 203 DPI (812 x 406 dots)
  const zpl = `^XA

^FX -- Company header --
^FO30,15
^A0N,22,22
^FDCraft & Culture^FS

^FX -- Large barcode --
^FO30,45
^BY2,3,65
^BCN,65,Y,N,N
^FD${data.barcode}^FS

^FX -- Horizontal separator --
^FO30,135
^GB750,2,2^FS

^FX -- Product name line 1 (prominent) --
^FO30,150
^A0N,32,32
^FD${productLine1}^FS

${productLine2 ? `^FX -- Product name line 2 --
^FO30,185
^A0N,32,32
^FD${productLine2}^FS
` : ''}
^FX -- Data fields section (3 rows) --
^FX -- Row 1: LWIN and Vintage --
^FO30,220
^A0N,20,20
^FDLWIN:^FS

^FO100,220
^A0N,20,20
^FD${lwin}^FS

^FO450,220
^A0N,20,20
^FDVintage:^FS

^FO530,220
^A0N,20,20
^FD${vintage}^FS

^FX -- Row 2: Size and Lot --
^FO30,245
^A0N,20,20
^FDSize:^FS

^FO100,245
^A0N,20,20
^FD${packSize}^FS

^FO450,245
^A0N,20,20
^FDLot:^FS

^FO530,245
^A0N,20,20
^FD${lot}^FS

^FX -- Row 3: Bay (location) --
^FO30,270
^A0N,20,20
^FDBay:^FS

^FO100,270
^A0N,20,20
^FD${location}^FS

^XZ`;

  return zpl;
};

/**
 * Generate ZPL for multiple labels (batch printing)
 *
 * @param labels - Array of label data
 * @returns Combined ZPL string for all labels
 */
export const generateBatchLabelsZpl = (labels: LabelData[]) => {
  return labels.map(generateLabelZpl).join('\n');
};

export default generateLabelZpl;
