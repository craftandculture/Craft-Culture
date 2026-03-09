/**
 * Generate ZPL for a per-level location label — one per shelf position
 *
 * Designed for 4" x 6" (100mm x 150mm) direct thermal labels on Zebra ZD421.
 * Placed on each shelf. Scanned during putaway and transfer operations.
 * Shows the full location code with a large QR for fast scanning.
 *
 * @example
 *   generateLevelLabelZpl({
 *     barcode: 'LOC-A-01-02',
 *     locationCode: 'A-01-02',
 *     aisle: 'A',
 *     bay: '01',
 *     level: '02',
 *     requiresForklift: true,
 *   });
 */

import { CC_LOGO_GF } from './zplLogo';

export interface LevelLabelData {
  /** Full barcode for scanning (e.g., LOC-A-01-02) */
  barcode: string;
  /** Location code without prefix (e.g., A-01-02) */
  locationCode: string;
  /** Aisle identifier (e.g., A) */
  aisle: string;
  /** Bay number (e.g., 01) */
  bay: string;
  /** Level number (e.g., 02) */
  level: string;
  /** Whether forklift is required to access */
  requiresForklift?: boolean | null;
}

/**
 * Escape special characters for ZPL
 */
const escapeZpl = (str: string) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/ß/g, 'ss')
    .replace(/\^/g, ' ')
    .replace(/~/g, ' ');
};

/**
 * Generate ZPL code for a single per-level location label
 *
 * Label layout (4" x 6" at 203 DPI = 812 x 1218 dots):
 * - C&C logo centred at top
 * - Separator
 * - Large QR code centred (mag 8), encodes full location barcode
 * - Location code ~100pt bold, centred
 * - Separator
 * - Level callout centred
 * - Separator
 * - Footer: AISLE A · BAY 01
 * - Forklift warning (if applicable)
 */
const generateLevelLabelZpl = (data: LevelLabelData) => {
  const aisle = escapeZpl(data.aisle);
  const bay = escapeZpl(data.bay);
  const level = escapeZpl(data.level);
  const levelNum = parseInt(data.level, 10);
  const levelLabel = levelNum <= 1 ? 'FLOOR' : `LEVEL ${level}`;

  // Centre the logo (400 dots wide). Label is 812 wide → x = (812 - 400) / 2 = 206
  const logoX = 206;

  // Direction arrow: A,C → right (>>>); B,D → left (<<<)
  const pointsRight = ['A', 'C'].includes(data.aisle.toUpperCase());
  const arrowChar = pointsRight ? '>>>' : '<<<';
  const arrowLabel = pointsRight ? 'BAY DIRECTION >>>' : '<<< BAY DIRECTION';
  const arrowZpl = `^FO0,1030
^A0N,80,80
^FB812,1,0,C
^FD${arrowChar}^FS
^FO0,1130
^A0N,30,30
^FB812,1,0,C
^FD${arrowLabel}^FS`;

  // Forklift warning line
  const forkliftZpl = data.requiresForklift
    ? `
^FX -- Forklift warning --
^FO0,930
^A0N,40,40
^FB812,1,0,C
^FD!! FORKLIFT REQUIRED !!^FS`
    : '';

  const zpl = `^XA
^PW812
^LL1218
^PR3
~SD20

^FX -- Outer border --
^FO20,20
^GB772,1178,4^FS

^FX -- C&C Logo centred --
^FO${logoX},30
${CC_LOGO_GF}^FS

^FX -- Top separator --
^FO40,165
^GB732,3,3^FS

^FX -- Large QR code centred (mag 12 ≈ ~300 dots) --
^FO256,200
^BQN,2,12
^FDMA,${data.barcode}^FS

^FX -- Location code (~120pt, centred) --
^FO0,540
^A0N,120,120
^FB812,1,0,C
^FD${aisle} - ${bay} - ${level}^FS

^FX -- Middle separator --
^FO40,695
^GB732,3,3^FS

^FX -- Level callout centred --
^FO0,735
^A0N,65,65
^FB812,1,0,C
^FD${levelLabel}^FS

^FX -- Lower separator --
^FO40,825
^GB732,3,3^FS

^FX -- Footer: AISLE / BAY --
^FO0,865
^A0N,44,44
^FB812,1,0,C
^FDAISLE ${aisle} \\: BAY ${bay}^FS
${forkliftZpl}

^FX -- Direction arrow (A,C = right; B,D = left) --
${arrowZpl}

^XZ`;

  return zpl;
};

/**
 * Generate ZPL for multiple per-level labels (batch printing)
 */
export const generateBatchLevelLabelsZpl = (labels: LevelLabelData[]) => {
  return labels.map(generateLevelLabelZpl).join('\n');
};

export default generateLevelLabelZpl;
