/**
 * Generate ZPL for a Compact Bay Totem - vertical strip on 4x2 label
 *
 * Design inspired by Camcode warehouse rack labels:
 * - Large bold level numbers in black boxes (like "D", "C", "B", "A")
 * - QR code next to level indicator
 * - Location code below QR
 * - Clean horizontal bands for each level
 *
 * Physical label: 4" x 2" at 203 DPI = 812 x 406 dots
 * When peeled and applied vertically (rotated 90° CCW): 2" wide x 4" tall
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
 * Generate ZPL for a compact vertical totem
 *
 * Physical label at 203 DPI: 812 x 406 dots (4" x 2")
 *
 * Coordinate system when applied vertically (rotated 90° CCW):
 * - Physical X (0-812) → Visual vertical (bottom to top)
 * - Physical Y (0-406) → Visual horizontal (left to right)
 *
 * Layout (Camcode-inspired):
 * Each level row has: [LEVEL#] [QR] [location code]
 * Level numbers in black boxes on left, QR in middle, text on right
 */
const generateCompactTotemZpl = (data: CompactTotemData) => {
  const bayCode = `${escapeZpl(data.aisle)}-${escapeZpl(data.bay)}`;

  // Physical label dimensions at 203 DPI
  const W = 812; // 4" width (becomes height when vertical)
  const H = 406; // 2" height (becomes width when vertical)

  // Margins
  const M = 10;

  // Header section (at top when applied = high X values)
  const headerW = 55;
  const headerX = W - M - headerW;

  // Calculate row dimensions for levels
  const levelCount = Math.min(data.levels.length, 5);
  const contentW = headerX - M - 5; // Space between margin and header
  const rowW = Math.floor(contentW / levelCount);

  // Element sizes within each row
  const levelBoxW = 75; // Black box width for level number
  const qrMag = 4; // QR magnification for larger codes

  let zpl = `^XA
^FX Compact Totem: ${bayCode}
^FX Physical: 812x406 (4x2 inches at 203 DPI)
^FX Applied vertically: High X = TOP, Low X = BOTTOM

^FX === HEADER BAR (TOP when applied) ===
^FO${headerX},${M}
^GB${headerW},${H - M * 2},${headerW},B^FS
^FO${headerX + 10},${M + 20}
^A0R,40,38
^FR^FDBay ${bayCode}^FS

`;

  // Generate each level row (highest level = closest to header)
  data.levels.slice(0, 5).forEach((level, idx) => {
    const levelNum = parseInt(level.level, 10);
    const levelChar = levelNum === 0 ? 'G' : String.fromCharCode(64 + levelNum); // A=1, B=2, etc. G=Ground
    const locCode = `${data.aisle}-${data.bay}-${level.level}`;

    // Row position: start from header, work down
    const rowStartX = headerX - 5 - (idx + 1) * rowW;
    const rowEndX = rowStartX + rowW;

    // Level box position (right side of row = left when applied)
    const boxX = rowEndX - levelBoxW;

    zpl += `
^FX === LEVEL ${level.level} ===

^FX Black box with level letter
^FO${boxX},${M}
^GB${levelBoxW},${H - M * 2},${levelBoxW},B^FS

^FX Level letter (large, centered in box)
^FO${boxX + 8},${Math.floor(H / 2) - 45}
^A0R,100,90
^FR^FD${levelChar}^FS

${
  level.requiresForklift
    ? `^FX Forklift indicator
^FO${boxX + 8},${H - M - 55}
^A0R,22,22
^FR^FD[F]^FS
`
    : ''
}

^FX QR Code
^FO${rowStartX + 8},${M + 15}
^BQN,2,${qrMag}
^FDMA,${level.barcode}^FS

^FX Location code
^FO${rowStartX + 8},${M + 175}
^A0R,28,28
^FD${escapeZpl(locCode)}^FS

^FX Row separator
^FO${rowStartX},${M}
^GB3,${H - M * 2},3^FS
`;
  });

  // Outer border
  zpl += `
^FX === OUTER BORDER ===
^FO${M},${M}
^GB${W - M * 2},${H - M * 2},3^FS

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
