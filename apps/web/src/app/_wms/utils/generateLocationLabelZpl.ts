/**
 * Generate ZPL (Zebra Programming Language) code for a location/rack label with QR code
 *
 * Designed for 4" x 2" (100mm x 50mm) direct thermal labels on Zebra ZD421 printer
 * Uses QR code for fast scanning from multiple angles
 *
 * @example
 *   generateLocationLabelZpl({
 *     barcode: 'LOC-A-01-02',
 *     locationCode: 'A-01-02',
 *     aisle: 'A',
 *     bay: '01',
 *     level: '02',
 *     locationType: 'rack',
 *     requiresForklift: true,
 *   });
 */

export interface LocationLabelData {
  /** Location barcode (e.g., LOC-A-01-02) */
  barcode: string;
  /** Location code without prefix (e.g., A-01-02) */
  locationCode: string;
  /** Aisle identifier (e.g., A) */
  aisle: string;
  /** Bay number (e.g., 01) */
  bay: string;
  /** Level number (e.g., 02) */
  level: string;
  /** Location type */
  locationType: 'rack' | 'floor' | 'receiving' | 'shipping';
  /** Whether forklift is required to access */
  requiresForklift?: boolean | null;
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
 * Get display text for location type
 */
const getLocationTypeDisplay = (type: string) => {
  const types: Record<string, string> = {
    rack: 'RACK',
    floor: 'FLOOR',
    receiving: 'RECEIVING',
    shipping: 'SHIPPING',
  };
  return types[type] || type.toUpperCase();
};

/**
 * Generate ZPL code for a single location label with QR code
 *
 * Label layout (4" x 2" at 203 DPI = 812 x 406 dots):
 * - Left: Large QR code containing barcode data
 * - Right: Location code in large text, level info, badges
 * - Clean, centered design with visual hierarchy
 */
const generateLocationLabelZpl = (data: LocationLabelData) => {
  const locationCode = escapeZpl(data.locationCode);
  const locationType = getLocationTypeDisplay(data.locationType);
  const forkliftText = data.requiresForklift ? 'FORKLIFT' : '';
  const levelNum = parseInt(data.level, 10);
  const levelLabel = levelNum <= 1 ? 'FLOOR' : `LEVEL ${levelNum}`;

  // ZPL code for 4" x 2" label at 203 DPI (812 x 406 dots)
  // Centered layout with larger QR code
  const zpl = `^XA

^FX -- Outer border for visual appeal --
^FO20,20
^GB772,366,3^FS

^FX -- Large QR Code on left (magnification 10 for better scanning) --
^FO50,60
^BQN,2,10
^FDMA,${data.barcode}^FS

^FX -- Vertical separator line --
^FO320,40
^GB3,326,3^FS

^FX -- Large location code (bold, prominent) --
^FO350,50
^A0N,100,100
^FD${locationCode}^FS

^FX -- Level indicator (large) --
^FO350,160
^A0N,55,55
^FD${levelLabel}^FS

^FX -- Location type badge with box --
^FO350,240
^GB150,50,2^FS
^FO360,250
^A0N,32,32
^FD${locationType}^FS

^FX -- Forklift indicator badge (if required) --
${forkliftText ? `^FO520,240
^GB160,50,2^FS
^FO530,250
^A0N,32,32
^FD${forkliftText}^FS` : ''}

^FX -- Aisle/Bay breakdown at bottom --
^FO350,310
^A0N,24,24
^FDAisle: ${escapeZpl(data.aisle)}  Bay: ${escapeZpl(data.bay)}^FS

^XZ`;

  return zpl;
};

/**
 * Generate ZPL for multiple location labels (batch printing)
 *
 * @param labels - Array of location label data
 * @returns Combined ZPL string for all labels
 */
export const generateBatchLocationLabelsZpl = (labels: LocationLabelData[]) => {
  return labels.map(generateLocationLabelZpl).join('\n');
};

export default generateLocationLabelZpl;
