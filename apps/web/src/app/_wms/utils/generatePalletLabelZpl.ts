/**
 * Generate ZPL (Zebra Programming Language) code for a pallet label with QR code
 *
 * Designed for 4" x 6" (100mm x 150mm) direct thermal labels on Zebra ZD421 printer
 * Uses QR code for fast scanning from multiple angles
 *
 * @example
 *   generatePalletLabelZpl({
 *     barcode: 'PALLET-2026-0001',
 *     palletCode: 'PALLET-2026-0001',
 *     ownerName: 'Cult Wine',
 *     totalCases: 70,
 *     status: 'sealed',
 *     sealedAt: new Date(),
 *     productSummary: [
 *       { productName: 'Chateau Margaux 2015', quantity: 40 },
 *       { productName: 'Dom Perignon 2012', quantity: 30 },
 *     ],
 *   });
 */

export interface ProductSummaryItem {
  /** Product name */
  productName: string;
  /** Number of cases of this product */
  quantity: number;
}

export interface PalletLabelData {
  /** Pallet barcode */
  barcode: string;
  /** Pallet code (e.g., PALLET-2026-0001) */
  palletCode: string;
  /** Owner/partner name */
  ownerName: string;
  /** Total number of cases on pallet */
  totalCases: number;
  /** Pallet status */
  status: 'active' | 'sealed' | 'retrieved' | 'archived';
  /** Date pallet was sealed (if sealed) */
  sealedAt?: Date | null;
  /** Location code where pallet is stored */
  locationCode?: string | null;
  /** Summary of products on pallet (top 5) */
  productSummary: ProductSummaryItem[];
}

/**
 * Normalize accented characters to ASCII equivalents
 */
const normalizeAccents = (str: string) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/ß/g, 'ss');
};

/**
 * Escape special characters for ZPL
 */
const escapeZpl = (str: string) => {
  return normalizeAccents(str).replace(/\^/g, ' ').replace(/~/g, ' ');
};

/**
 * Truncate string to max length with ellipsis
 */
const truncate = (str: string, maxLen: number) => {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
};

/**
 * Format date as YYYY-MM-DD
 */
const formatDate = (date: Date | null | undefined) => {
  if (!date) return '-';
  return new Date(date).toISOString().split('T')[0];
};

/**
 * Generate ZPL code for a single pallet label with QR code
 *
 * Label layout (4" x 6" at 203 DPI = 812 x 1218 dots):
 * - Top: Large QR code centered
 * - Middle: Pallet code, owner, case count
 * - Bottom: Product summary list
 */
const generatePalletLabelZpl = (data: PalletLabelData) => {
  const palletCode = escapeZpl(data.palletCode);
  const ownerName = escapeZpl(truncate(data.ownerName, 30));
  const status = data.status.toUpperCase();
  const sealedDate = formatDate(data.sealedAt);
  const locationCode = data.locationCode ? escapeZpl(data.locationCode) : '-';

  // Take top 5 products for summary
  const topProducts = data.productSummary.slice(0, 5);

  // Build product summary lines
  const productLines = topProducts
    .map((p, i) => {
      const name = escapeZpl(truncate(p.productName, 32));
      const yPos = 680 + i * 50;
      return `^FO50,${yPos}
^A0N,28,28
^FD${p.quantity}x ${name}^FS`;
    })
    .join('\n');

  // Show "+X more products" if there are more than 5
  const moreProductsLine =
    data.productSummary.length > 5
      ? `^FO50,${680 + 5 * 50}
^A0N,24,24
^FD+${data.productSummary.length - 5} more products^FS`
      : '';

  // ZPL code for 4" x 6" label at 203 DPI (812 x 1218 dots)
  const zpl = `^XA

^FX -- Company header --
^FO50,30
^A0N,28,28
^FDCraft & Culture Warehouse^FS

^FX -- Horizontal separator --
^FO30,70
^GB752,3,3^FS

^FX -- Large QR Code centered at top --
^FO206,100
^BQN,2,12
^FDMA,${data.barcode}^FS

^FX -- Pallet code (large, bold) --
^FO50,400
^A0N,60,60
^FD${palletCode}^FS

^FX -- Status badge --
^FO50,470
^GB120,45,2^FS
^FO60,478
^A0N,30,30
^FD${status}^FS

^FX -- Total cases (large number) --
^FO550,440
^A0N,80,80
^FD${data.totalCases}^FS

^FO550,520
^A0N,24,24
^FDCASES^FS

^FX -- Horizontal separator --
^FO30,560
^GB752,2,2^FS

^FX -- Owner and sealed date --
^FO50,580
^A0N,28,28
^FDOwner: ${ownerName}^FS

^FO50,620
^A0N,24,24
^FDSealed: ${sealedDate}   Location: ${locationCode}^FS

^FX -- Product summary header --
^FO50,660
^A0N,24,24
^FDCONTENTS:^FS

^FX -- Product summary list --
${productLines}

${moreProductsLine}

^FX -- Horizontal separator --
^FO30,960
^GB752,2,2^FS

^FX -- Barcode text at bottom --
^FO50,980
^A0N,20,20
^FD${data.barcode}^FS

^FX -- Scan instruction --
^FO50,1010
^A0N,18,18
^FDScan QR code to view pallet details^FS

^XZ`;

  return zpl;
};

/**
 * Generate ZPL for multiple pallet labels (batch printing)
 *
 * @param labels - Array of pallet label data
 * @returns Combined ZPL string for all labels
 */
export const generateBatchPalletLabelsZpl = (labels: PalletLabelData[]) => {
  return labels.map(generatePalletLabelZpl).join('\n');
};

export default generatePalletLabelZpl;
