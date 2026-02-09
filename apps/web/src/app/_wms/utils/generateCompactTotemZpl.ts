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

  // ===========================================
  // COORDINATE SYSTEM (4x2 label rotated 90° CCW)
  // ===========================================
  // Physical print: 812w x 406h dots (4" x 2")
  // After CCW rotation to apply vertically:
  //
  //   Physical X (0-812, left→right) → Applied VERTICAL (bottom→top)
  //   Physical Y (0-406, top→bottom) → Applied HORIZONTAL (right→left)
  //
  // KEY INSIGHT: Physical Y is REVERSED horizontally!
  //   Y=0   (physical top)    → RIGHT side when applied
  //   Y=406 (physical bottom) → LEFT side when applied
  //
  // ===========================================

  const W = 812; // Physical width (applied: height)
  const H = 406; // Physical height (applied: width, but REVERSED)

  const M = 8; // Margin
  const headerH = 50; // Header height
  const levelCount = Math.min(data.levels.length, 5);
  const rowH = Math.floor((W - M * 2 - headerH) / levelCount);

  // HORIZONTAL ZONES (physical Y → applied horizontal, REVERSED)
  // Applied layout: [LEVEL BOX] [QR CODE] [LOCATION TEXT]
  //                    LEFT       CENTER      RIGHT
  // Physical Y:        HIGH        MID        LOW
  //
  const levelZoneW = 70; // Level number zone
  const qrZoneW = 130; // QR code zone

  // Physical Y positions (remember: high Y = LEFT when applied)
  const levelY = H - M - levelZoneW; // ~328 - LEFT zone
  const qrY = levelY - qrZoneW; // ~198 - CENTER zone
  const textY = M; // ~8 - RIGHT zone

  let zpl = `^XA

^FX === HEADER (TOP when applied = high X) ===
^FO${W - M - headerH},${M}
^GB${headerH},${H - M * 2},${headerH},B^FS
^FO${W - M - headerH + 8},${Math.floor(H / 2) - 55}
^A0R,36,34^FR
^FDBay ${bayCode}^FS

`;

  data.levels.slice(0, 5).forEach((level, idx) => {
    const levelText = level.level.padStart(2, '0');
    const locCode = `${data.aisle}-${data.bay}-${level.level}`;

    // Row vertical position (high X = top when applied)
    const rowBottom = W - M - headerH - (idx + 1) * rowH;
    const rowCenterX = rowBottom + Math.floor(rowH / 2);

    zpl += `
^FX === LEVEL ${level.level} ===

^FX LEVEL NUMBER (LEFT zone - high Y)
^FO${rowCenterX - 28},${levelY}
^GB58,${levelZoneW - 5},2^FS
^FO${rowCenterX - 20},${levelY + 12}
^A0R,48,44
^FD${levelText}^FS

^FX QR CODE (CENTER zone - mid Y)
^FO${rowCenterX - 50},${qrY + 5}
^BQN,2,4
^FDMA,${level.barcode}^FS

^FX LOCATION + FORKLIFT (RIGHT zone - low Y)
^FO${rowCenterX - 35},${textY}
^A0R,26,24
^FD${escapeZpl(locCode)}${level.requiresForklift ? ' [F]' : ''}^FS

^FX Row separator line
^FO${rowBottom},${M}
^GB2,${H - M * 2},2^FS
`;
  });

  // Bottom edge line and outer border
  zpl += `
^FO${M},${M}^GB2,${H - M * 2},2^FS
^FO${M},${M}^GB${W - M * 2},${H - M * 2},2^FS
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
