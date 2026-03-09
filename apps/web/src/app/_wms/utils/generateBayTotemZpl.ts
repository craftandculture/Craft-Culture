/**
 * Generate ZPL for a Bay Totem label — clean, bold, visible from metres away
 *
 * Designed for 4" x 6" (100mm x 150mm) direct thermal labels on Zebra ZD421.
 * Mount on rack end-cap at eye level. Shows bay identifier with large QR and
 * a strip listing all levels in the bay.
 *
 * @example
 *   generateBayTotemZpl({
 *     aisle: 'A',
 *     bay: '01',
 *     levels: [
 *       { level: '03', barcode: 'LOC-A-01-03', requiresForklift: true },
 *       { level: '02', barcode: 'LOC-A-01-02', requiresForklift: true },
 *       { level: '01', barcode: 'LOC-A-01-01', requiresForklift: false },
 *       { level: '00', barcode: 'LOC-A-01-00', requiresForklift: false },
 *     ],
 *   });
 */

import { CC_LOGO_GF } from './zplLogo';

export interface TotemLevel {
  /** Level number (e.g., '00', '01', '02', '03') */
  level: string;
  /** Full barcode (e.g., 'LOC-A-01-02') */
  barcode: string;
  /** Whether forklift is required */
  requiresForklift?: boolean | null;
}

export interface BayTotemData {
  /** Aisle identifier (e.g., 'A') */
  aisle: string;
  /** Bay number (e.g., '01') */
  bay: string;
  /** Levels from top to bottom (highest first) */
  levels: TotemLevel[];
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
 * Generate ZPL code for a single bay totem label
 *
 * Label layout (4" x 6" at 203 DPI = 812 x 1218 dots):
 * - C&C logo centred at top
 * - Separator
 * - Large QR code centred (mag 8), encodes LOC-{aisle}-{bay}
 * - Bay code ~120pt bold, centred
 * - Separator
 * - Levels strip: LVL 00 · 01 · 02 · 03
 * - Separator
 * - Footer: AISLE A · BAY 01
 */
const generateBayTotemZpl = (data: BayTotemData) => {
  const aisle = escapeZpl(data.aisle);
  const bay = escapeZpl(data.bay);
  const bayBarcode = `LOC-${data.aisle}-${data.bay}`;

  // Build levels strip text: "LVL 00 · 01 · 02 · 03"
  // Sort ascending for the strip display (lowest first, left to right)
  const sortedLevels = [...data.levels].sort((a, b) => {
    return parseInt(a.level, 10) - parseInt(b.level, 10);
  });
  const levelsText = `LVL ${sortedLevels.map((l) => l.level).join(' \\: ')}`;

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
^FDMA,${bayBarcode}^FS

^FX -- Bay code (~180pt, centred) --
^FO0,560
^A0N,180,180
^FB812,1,0,C
^FD${aisle} - ${bay}^FS

^FX -- Middle separator --
^FO40,780
^GB732,3,3^FS

^FX -- Levels strip centred --
^FO0,820
^A0N,55,55
^FB812,1,0,C
^FD${levelsText}^FS

^FX -- Lower separator --
^FO40,900
^GB732,3,3^FS

^FX -- Footer: AISLE / BAY --
^FO0,940
^A0N,44,44
^FB812,1,0,C
^FDAISLE ${aisle}  \\:  BAY ${bay}^FS

^FX -- Direction arrow (A,C = right; B,D = left) --
${arrowZpl}

^XZ`;

  return zpl;
};

/**
 * Generate ZPL for multiple bay totems (batch printing)
 */
export const generateBatchBayTotemsZpl = (totems: BayTotemData[]) => {
  return totems.map(generateBayTotemZpl).join('\n');
};

export default generateBayTotemZpl;
