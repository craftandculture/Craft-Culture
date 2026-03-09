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

import { CC_LOGO_GF } from './zplLogo';

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
  const levelLabel = isNaN(levelNum) ? '' : levelNum <= 1 ? 'FLOOR' : `LEVEL ${levelNum}`;

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
 * Generate ZPL for a large 4x6" area label (GOODS INBOUND, SHIPPING, etc.)
 *
 * 4x6" at 203 DPI = 812 x 1218 dots. Bold, readable from distance.
 */
export const generateAreaLabelZpl = (data: LocationLabelData) => {
  const locationCode = escapeZpl(data.locationCode);
  const locationType = getLocationTypeDisplay(data.locationType);

  return `^XA
^PR3
~SD20
^MTD^JUS

^FX -- Outer border --
^FO20,20
^GB772,1178,4^FS

^FX -- C&C logo (400x119 dots, centred) --
^FO206,50
${CC_LOGO_GF}^FS

^FX -- Separator --
^FO40,190
^GB732,3,3^FS

^FX -- Large QR code (centred, mag 10) --
^FO230,240
^BQN,2,10
^FDMA,${data.barcode}^FS

^FX -- Location name (huge, centred) --
^FO40,620
^A0N,120,120
^FB732,2,0,C
^FD${locationCode}^FS

^FX -- Separator --
^FO40,860
^GB732,3,3^FS

^FX -- Location type badge (centred) --
^FO40,900
^A0N,60,60
^FB732,1,0,C
^FD${locationType}^FS

^FX -- Scan instruction --
^FO40,1000
^A0N,28,28
^FB732,1,0,C
^FDSCAN QR TO SELECT LOCATION^FS

^FX -- Separator --
^FO40,1060
^GB732,3,3^FS

^FX -- Barcode at bottom --
^FO40,1100
^A0N,22,22
^FB732,1,0,C
^FD${escapeZpl(data.barcode)}^FS

^FX -- craftculture.xyz --
^FO40,1150
^A0N,18,18
^FB732,1,0,C
^FDcraftculture.xyz^FS

^XZ`;
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
