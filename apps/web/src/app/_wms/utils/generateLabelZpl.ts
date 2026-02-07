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
  /** Lot number */
  lotNumber?: string;
  /** Location code where case is stored (e.g., A-01-02) */
  locationCode?: string;
}

/**
 * Truncate string to max length, adding ellipsis if needed
 */
const truncate = (str: string, maxLength: number) => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
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
 * Label layout (4" x 2" at 203 DPI = 812 x 406 dots):
 * - Top: Large Code 128 barcode with human-readable text
 * - Middle: Product name (bold, truncated if needed)
 * - Bottom: LWIN | Pack size | Lot | Location
 */
const generateLabelZpl = (data: LabelData) => {
  const productName = escapeZpl(truncate(data.productName, 35));
  const lwin = escapeZpl(data.lwin18);
  const packSize = escapeZpl(data.packSize || '');
  const lot = data.lotNumber ? escapeZpl(data.lotNumber) : '-';
  const location = data.locationCode ? escapeZpl(data.locationCode) : '-';

  // ZPL code for 4" x 2" label at 203 DPI
  // ^XA = Start format
  // ^FO = Field origin (x, y in dots)
  // ^BY = Barcode defaults (module width, ratio, height)
  // ^BC = Code 128 barcode
  // ^FD = Field data
  // ^FS = Field separator
  // ^A0 = Font 0 (scalable)
  // ^XZ = End format
  const zpl = `^XA

^FX -- Barcode at top --
^FO50,30
^BY2,3,80
^BCN,80,Y,N,N
^FD${data.barcode}^FS

^FX -- Product name (large, bold) --
^FO50,140
^A0N,40,40
^FD${productName}^FS

^FX -- LWIN code --
^FO50,190
^A0N,24,24
^FDLWIN: ${lwin}^FS

^FX -- Pack size --
^FO400,190
^A0N,24,24
^FD${packSize}^FS

^FX -- Lot and Location --
^FO50,220
^A0N,24,24
^FDLot: ${lot}^FS

^FO400,220
^A0N,24,24
^FDBay: ${location}^FS

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
