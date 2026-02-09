/**
 * Generate ZPL for a Compact Bay Totem - 2 levels per label
 *
 * Optimized for:
 * - Ground totem (00 + 01): Picking levels, scannable from ground
 * - Pallet totem (02 + 03): Forklift levels, visual + scannable when elevated
 *
 * With only 2 levels per label:
 * - BIG QR codes (easy to scan, no confusion)
 * - BIG level numbers (visible from distance)
 * - Clear separation between levels
 *
 * Physical: 4" x 2" at 203 DPI = 812 x 406 dots
 * Applied vertically (90° CCW): X=bottom→top, Y=right→left
 */

export interface CompactTotemLevel {
  level: string;
  barcode: string;
  requiresForklift?: boolean | null;
}

export interface CompactTotemData {
  aisle: string;
  bay: string;
  levels: CompactTotemLevel[];
  arrowDirection?: 'left' | 'right';
}

/**
 * Escape special characters for ZPL
 */
const escapeZpl = (str: string) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\^/g, ' ')
    .replace(/~/g, ' ');
};

/**
 * Generate ZPL for 2-level totem
 *
 * Visual layout (when applied vertically):
 * ┌──────────────────────────────────────┐
 * │          Bay A-01                   │ ← Header
 * ├──────────────────────────────────────┤
 * │                                      │
 * │   01      ▓▓▓▓▓▓      A-01-01      │ ← Level + BIG QR
 * │           ▓▓▓▓▓▓                    │
 * │           ▓▓▓▓▓▓                    │
 * │                                      │
 * ├──────────────────────────────────────┤
 * │                                      │
 * │   00      ▓▓▓▓▓▓      A-01-00      │
 * │           ▓▓▓▓▓▓                    │
 * │           ▓▓▓▓▓▓                    │
 * │                                      │
 * └──────────────────────────────────────┘
 */
const generateCompactTotemZpl = (data: CompactTotemData) => {
  const bayCode = `${escapeZpl(data.aisle)}-${escapeZpl(data.bay)}`;

  // Physical dimensions at 203 DPI
  // After 90° CCW rotation: X=bottom→top, Y=right→left
  const W = 812; // Physical width → applied height
  const H = 406; // Physical height → applied width (REVERSED: high Y = left)

  const M = 10;
  const headerH = 55;

  // Use up to 2 levels
  const levels = data.levels.slice(0, 2);
  const levelCount = levels.length;

  if (levelCount === 0) {
    return `^XA^FO50,50^A0,30,30^FDNo levels^FS^XZ`;
  }

  const rowH = Math.floor((W - M * 2 - headerH) / levelCount);

  // Check if any level requires forklift (for header indicator)
  const hasForklift = levels.some((l) => l.requiresForklift);

  let zpl = `^XA

^FX === HEADER (TOP when applied) ===
^FO${W - M - headerH},${M}
^GB${headerH},${H - M * 2},${headerH},B^FS

^FX Bay name
^FO${W - M - headerH + 8},${M + 30}
^A0R,44,42^FR
^FDBay ${bayCode}${hasForklift ? ' [F]' : ''}^FS

`;

  // Each level - BIG QR + BIG number
  levels.forEach((level, idx) => {
    const levelNum = level.level.padStart(2, '0');
    const locCode = `${data.aisle}-${data.bay}-${level.level}`;

    // Row position (high X = top when applied)
    const rowBottom = W - M - headerH - (idx + 1) * rowH;
    const rowMid = rowBottom + Math.floor(rowH / 2);

    // With 2 levels, each row is ~350 dots tall
    // Layout within row (Y axis, reversed):
    //   High Y (left when applied): Level number
    //   Mid Y: QR code
    //   Low Y (right when applied): Location code

    const levelNumY = H - M - 80; // Left zone
    const qrY = H - M - 80 - 130; // Center zone (after level num)
    const locY = M + 15; // Right zone

    zpl += `
^FX === LEVEL ${level.level} ===

^FX Level number (LEFT when applied)
^FO${rowMid - 35},${levelNumY}
^A0R,80,75
^FD${levelNum}^FS

^FX BIG QR Code (CENTER when applied)
^FO${rowMid - 55},${qrY}
^BQN,2,5
^FDMA,${level.barcode}^FS

^FX Location code (RIGHT when applied)
^FO${rowMid - 30},${locY}
^A0R,26,24
^FD${escapeZpl(locCode)}^FS

^FX Row separator
^FO${rowBottom},${M}
^GB2,${H - M * 2},2^FS
`;
  });

  // Outer border
  zpl += `
^FO${M},${M}
^GB${W - M * 2},${H - M * 2},2^FS
^XZ`;

  return zpl;
};

/**
 * Generate ZPL for multiple compact totems (batch printing)
 */
export const generateBatchCompactTotemsZpl = (totems: CompactTotemData[]) => {
  return totems.map(generateCompactTotemZpl).join('\n');
};

export default generateCompactTotemZpl;
