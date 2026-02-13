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
  barcode?: string;
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
  /** Owner/partner name (e.g., Cru Wine, Cult Wine) */
  owner?: string;
  /** Whether to show the barcode (default: true) */
  showBarcode?: boolean;
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
 * Extract vintage year from LWIN-18 code
 * LWIN-18 format: 7-digit producer + 4-digit vintage + 2-digit pack + 5-digit bottle size
 * Example: 1007286-2016-12-00750 → vintage is 2016
 */
const extractVintageFromLwin = (lwin18: string) => {
  // Remove dashes to get raw digits
  const digits = lwin18.replace(/-/g, '');
  if (digits.length >= 11) {
    const vintageStr = digits.slice(7, 11);
    const vintage = parseInt(vintageStr, 10);
    // Validate it's a reasonable year (1900-2100)
    if (vintage >= 1900 && vintage <= 2100) {
      return vintage;
    }
  }
  return null;
};

/** Craft & Culture logo as ZPL graphic (200x60 dots, monochrome) */
const CC_LOGO_GF = '^GFA,1500,1500,25,00000000000000000000000000000000000000000000000000FFFFFFFFFFFFC0000000000000000000000000000000000000FFFFFFFFFFFFC0000000000000000000000000000000000000FFFFFFFFFFFFC0000000000000000000000000000000000000E00000000001C0000000000000000000000000000000000000E00000000001C0000000000000000000000000000000000000E00000000001C0000000000000000000000000000000000000E00000000001C00001FE007FE0000E000FFF07FFF0007E0000E00000000001C00003FF807FF8001E001FFF87FFF000FF0000E00000000001C0000FFFC07FFC001F000FFF87FFF001FF8000E00000000001C0001F03E0703E003F001E00001C0001C38000E00000000001C0001E01E0700E003F000E00001C0001C1C000E00000FFFF01C0003C0000700E007B800E00001C0001C38000E00007FFFF01C000380000700E0073801E00001C0001E78000E0001FFFFF01C000780000700E0073C01E00001C0000EF0000E0007F800001C000780000701E00F1C01FFC001C0000FE0000E000FC000001C0007000007FFC00E1C00FFC001C00007C1C00E001F0000001C0007000007FF800E0E00FFC001C0001FC3800E003C0000001C0007800007FF001EFE00E00001C0003DE3800E007801FFF01C000380000707001FFF00E00001C00078F7800E00F00FFFF01C0003C0000707803FFF00E00001C000707F000E00F03FFFF01C0003C0000703803C0701E00001C000703E000E01E07E00001C0001E01E0703C0380781E00001C000701E000E01C0F800001C0000F87E0701C0780380E00001C000783E000E01C0F000001C00007FFC0701E0700380E00001C0003FFF000E0381E000001C00003FF80700F0F003C1E00001C0003FF7800E0381C000001C000007C000000000000000000000000FC0000E0383C000001C0000000000000000000000000000000000000E03838000001C0000000000000000000000000000000000000E03838000001C0000000000000000000000000000000000000E03838000001C0000000000000000000000000000000000000E03838000001C0000000000000000000000000000000000000E03838000001C0000000000000000000000000000000000000E03838000001C00000FE00600701800FFFE0E00603FE001FFEE0381C000001C00003FF80E00703800FFFE0E00F03FFC03FFEE03C1E000001C0000FFFC0E00703800FFFE0E00F03FFE03FFEE01C0F000001C0001F03E0E0070380007800E00F0381E03C00E01C07800001C0001E01C0E0070380003800E00F0380F03800E01E03E00001C0003C0000E0070380003800E00F0380703800E00F01FFFF01C000380000E0070380003800E00F0380703800E00F00FFFF01C000780000E0070380003800E00F0380F03C00E007801FFF01C000780000E0070380003800E00F0381E03FFCE003C0000001C000700000E0070380003800E00F03FFE03FFCE001F0000001C000700000E0070380003800E00F03FFC03FF8E000FC000001C000780000E0070380003800E00F03FF803800E0007F000001C000380000E0070380003800E00F0387803800E0001FFFFF01C0003C0000F0070380003800E00E0383803800E00007FFFF01C0003C00C0700F0380003800F00E0383C03800E00000FFFF01C0001F01E0781E0380003800781E0381E03800E00000000001C0000FC7E03E7E03FFE038007E7C0381E03FFEE00000000001C00007FFC03FFC03FFE038003FF80380F03FFEE00000000001C00001FF000FF803FFE038001FF00380703FFEE00000000001C00000380003C0000000000003800000000000E00000000001C0000000000000000000000000000000000000E00000000001C0000000000000000000000000000000000000E00000000001C0000000000000000000000000000000000000FFFFFFFFFFFFC0000000000000000000000000000000000000FFFFFFFFFFFFC0000000000000000000000000000000000000FFFFFFFFFFFFC0000000000000000000000000000000000000';

/**
 * Generate ZPL code for a single case label
 *
 * Professional wine warehouse label layout (4" x 2" at 203 DPI = 812 x 406 dots)
 * - C&C logo header
 * - Large barcode
 * - Product name (2 lines if needed)
 * - Labeled data fields in clean columns
 */
const generateLabelZpl = (data: LabelData) => {
  const [productLine1, productLine2] = splitToTwoLines(escapeZpl(data.productName), 38);
  const lwin = escapeZpl(data.lwin18);
  const packSize = escapeZpl(data.packSize || '-');
  // Use provided vintage, or extract from LWIN-18 if not provided
  const vintageValue = data.vintage || extractVintageFromLwin(data.lwin18);
  const vintage = vintageValue ? String(vintageValue) : '-';
  const lot = data.lotNumber ? escapeZpl(data.lotNumber) : '-';
  const owner = data.owner ? escapeZpl(data.owner) : '-';

  const showBarcode = data.showBarcode !== false && data.barcode;

  // ZPL code for 4" x 2" label at 203 DPI (812 x 406 dots)
  // Two layouts: with barcode (WMS) and without barcode (PCO)
  const zpl = showBarcode
    ? `^XA

^FX -- C&C logo (200x60 dots) --
^FO30,8
${CC_LOGO_GF}^FS

^FX -- Large barcode --
^FO30,75
^BY2,3,55
^BCN,55,Y,N,N
^FD${data.barcode}^FS

^FX -- Horizontal separator --
^FO30,155
^GB750,2,2^FS

^FX -- Product name line 1 (prominent) --
^FO30,168
^A0N,30,30
^FD${productLine1}^FS

${productLine2 ? `^FX -- Product name line 2 --
^FO30,200
^A0N,30,30
^FD${productLine2}^FS
` : ''}
^FX -- Data fields section --
^FX -- Row 1: Pack Size (LARGE, prominent) --
^FO30,236
^A0N,34,34
^FD${packSize}^FS

^FX -- Row 2: Vintage and Owner --
^FO30,280
^A0N,22,22
^FDVintage: ${vintage}^FS

^FO400,280
^A0N,22,22
^FDOwner: ${owner}^FS

^FX -- Row 3: Lot/Order (prominent) --
^FO30,315
^A0N,30,30
^FD${lot}^FS

^FX -- Row 4: LWIN --
^FO30,355
^A0N,20,20
^FDLWIN: ${lwin}^FS

^XZ`
    : `^XA

^FX -- C&C logo (200x60 dots) --
^FO30,8
${CC_LOGO_GF}^FS

^FX -- Horizontal separator --
^FO30,75
^GB750,2,2^FS

^FX -- PCO number (large, clearly labeled) --
^FO30,90
^A0N,40,40
^FD${lot}^FS

^FX -- Owner (prominent) --
^FO30,140
^A0N,34,34
^FD${owner}^FS

^FX -- Separator --
^FO30,182
^GB750,1,1^FS

^FX -- Product name --
^FO30,195
^A0N,30,30
^FD${productLine1}^FS

${productLine2 ? `^FO30,228
^A0N,30,30
^FD${productLine2}^FS
` : ''}
^FX -- Pack Size / Vintage --
^FO30,268
^A0N,26,26
^FD${packSize}^FS

^FO500,268
^A0N,26,26
^FD${vintage !== '-' ? 'Vintage: ' + vintage : ''}^FS

^FX -- LWIN --
^FO30,305
^A0N,20,20
^FDLWIN: ${lwin}^FS

^FX -- Separator --
^FO30,335
^GB750,1,1^FS

^FX -- Instagram icon (simplified camera outline) --
^FO30,346
^GB22,22,2,B,0^FS
^FO37,352
^GB8,8,2,B,0^FS
^FO48,347
^GB3,3,3,B,0^FS

^FX -- Instagram handle --
^FO60,348
^A0N,22,22
^FD@wine.uae^FS

^FX -- Globe icon (circle + crosshair) --
^FO520,346
^GE22,22,2,B^FS
^FO530,346
^GB1,22,1,B,0^FS
^FO520,356
^GB22,1,1,B,0^FS

^FX -- Website --
^FO548,348
^A0N,22,22
^FDcraftculture.xyz^FS

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
