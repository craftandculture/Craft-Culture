/**
 * Generate ZPL for a Compact Bay Totem - vertical strip on 4x2 label
 *
 * Inspired by Camcode warehouse rack labels:
 * - Clean horizontal bands for each level
 * - Level number in small box on LEFT
 * - QR code in CENTER
 * - Location code BELOW QR (small text)
 * - Thin separator lines (not thick black bars)
 *
 * Physical: 4" x 2" at 203 DPI = 812 x 406 dots
 * Applied vertically: X=bottom→top, Y=left→right
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
 * Visual layout (when applied vertically):
 * ┌────────────────────────────┐
 * │      Bay A-01              │ ← Thin header
 * ├────────────────────────────┤
 * │ ┌──┐                       │
 * │ │04│  ▓▓▓▓   A-01-04 [F]  │ ← Level row
 * │ └──┘  QR                   │
 * ├────────────────────────────┤
 * │ ┌──┐                       │
 * │ │03│  ▓▓▓▓   A-01-03 [F]  │
 * │ └──┘  QR                   │
 * ├────────────────────────────┤
 * │ etc...                     │
 * └────────────────────────────┘
 */
const generateCompactTotemZpl = (data: CompactTotemData) => {
  const bayCode = `${escapeZpl(data.aisle)}-${escapeZpl(data.bay)}`;

  // Physical dimensions at 203 DPI
  const W = 812; // 4" - becomes visual height
  const H = 406; // 2" - becomes visual width

  // Margins and spacing
  const M = 10;
  const headerH = 45;
  const levelCount = Math.min(data.levels.length, 5);
  const rowH = Math.floor((W - M * 2 - headerH) / levelCount);

  // Visual column widths (physical Y positions)
  const levelBoxSize = 50; // Small box for level number
  const qrStartY = M + levelBoxSize + 10;
  const locStartY = qrStartY + 95; // After QR code

  let zpl = `^XA

^FX === BAY HEADER ===
^FO${W - M - headerH},${M}
^GB${headerH},${H - M * 2},${headerH},B^FS
^FO${W - M - headerH + 5},${M + 50}
^A0R,32,30^FR
^FDBay ${bayCode}^FS

`;

  // Each level row
  data.levels.slice(0, 5).forEach((level, idx) => {
    const levelText = level.level.padStart(2, '0');
    const locCode = `${data.aisle}-${data.bay}-${level.level}`;

    // Row position (X = vertical when applied)
    const rowX = W - M - headerH - 5 - (idx + 1) * rowH;

    zpl += `
^FX === LEVEL ${level.level} ===

^FX Level box (outlined, not filled)
^FO${rowX + rowH - levelBoxSize - 5},${M + 2}
^GB${levelBoxSize},${levelBoxSize},2^FS

^FX Level number
^FO${rowX + rowH - levelBoxSize},${M + 8}
^A0R,38,36
^FD${levelText}^FS

^FX QR Code
^FO${rowX + 5},${qrStartY}
^BQN,2,3
^FDMA,${level.barcode}^FS

^FX Location code
^FO${rowX + 5},${locStartY}
^A0R,24,22
^FD${escapeZpl(locCode)}^FS

${
  level.requiresForklift
    ? `^FX Forklift badge
^FO${rowX + 40},${locStartY}
^A0R,20,18
^FD[F]^FS
`
    : ''
}

^FX Thin separator line
^FO${rowX},${M}
^GB2,${H - M * 2},2^FS
`;
  });

  // Outer border
  zpl += `
^FX === OUTER BORDER ===
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
