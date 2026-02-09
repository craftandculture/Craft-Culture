/**
 * Generate ZPL for a Compact Bay Totem - PALLET LEVELS ONLY
 *
 * Purpose: Visual identification for forklift operators
 * - BIG level numbers visible from forklift cab
 * - Small QR code in header for bay-level scanning
 * - Location codes for reference
 * - Optimized for 2-4 pallet levels (not picking levels)
 *
 * Picking levels (00, 01) should use individual 4x6 labels instead.
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
 * Generate ZPL for pallet level totem
 *
 * Visual layout (when applied vertically):
 * ┌──────────────────────────────────────┐
 * │  BAY A-01              [QR]         │ ← Header with bay QR
 * ├──────────────────────────────────────┤
 * │                                      │
 * │    04               A-01-04         │ ← BIG level number
 * │                                      │
 * ├──────────────────────────────────────┤
 * │                                      │
 * │    03               A-01-03         │
 * │                                      │
 * ├──────────────────────────────────────┤
 * │                                      │
 * │    02               A-01-02         │
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
  const headerH = 70; // Taller header for bay name + QR

  // Filter to forklift levels only, max 4
  const palletLevels = data.levels
    .filter((l) => l.requiresForklift)
    .slice(0, 4);

  // If no forklift levels, use all levels (fallback)
  const levels = palletLevels.length > 0 ? palletLevels : data.levels.slice(0, 4);
  const levelCount = levels.length;

  if (levelCount === 0) {
    return `^XA^FO50,50^A0,30,30^FDNo levels^FS^XZ`;
  }

  const rowH = Math.floor((W - M * 2 - headerH) / levelCount);

  // Get bay barcode from first level (for header QR)
  const bayBarcode = `BAY-${data.aisle}-${data.bay}`;

  let zpl = `^XA

^FX === HEADER: Bay name + QR (TOP when applied) ===
^FO${W - M - headerH},${M}
^GB${headerH},${H - M * 2},${headerH},B^FS

^FX Bay name (large, white on black)
^FO${W - M - headerH + 10},${M + 20}
^A0R,50,48^FR
^FDBay ${bayCode}^FS

^FX Bay QR code (small, in header)
^FO${W - M - headerH + 10},${H - M - 90}
^BQN,2,2^FR
^FDMA,${bayBarcode}^FS

`;

  // Each pallet level - BIG numbers, visual-first
  levels.forEach((level, idx) => {
    const levelNum = level.level.padStart(2, '0');
    const locCode = `${data.aisle}-${data.bay}-${level.level}`;

    // Row position
    const rowBottom = W - M - headerH - (idx + 1) * rowH;
    const rowMid = rowBottom + Math.floor(rowH / 2);

    zpl += `
^FX === LEVEL ${level.level} ===

^FX BIG level number (LEFT when applied = high Y)
^FO${rowMid - 40},${H - M - 110}
^A0R,90,85
^FD${levelNum}^FS

^FX Location code (RIGHT when applied = low Y)
^FO${rowMid - 25},${M + 10}
^A0R,28,26
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
