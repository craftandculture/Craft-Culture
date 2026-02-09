/**
 * Generate ZPL for a Compact Bay Totem - vertical strip on 4x2 label
 *
 * Physical label: 4" x 2" at 203 DPI = 812 x 406 dots
 * When peeled and applied vertically (rotated 90° CCW): 2" wide x 4" tall
 *
 * Layout when applied vertically:
 * - TOP: Bay header (black bar with "Bay A-01")
 * - MIDDLE: Levels from highest (04) to lowest (00/FLOOR)
 * - BOTTOM: Direction arrow
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
 * When label is peeled and rotated 90° counter-clockwise for vertical application:
 * - Physical X=812 (right edge) becomes visual TOP
 * - Physical X=0 (left edge) becomes visual BOTTOM
 * - Physical Y stays as visual left-to-right
 *
 * So we place:
 * - Bay header at HIGH X values (right edge → top when applied)
 * - Arrow at LOW X values (left edge → bottom when applied)
 */
const generateCompactTotemZpl = (data: CompactTotemData) => {
  const bayCode = `${escapeZpl(data.aisle)}-${escapeZpl(data.bay)}`;
  const arrow = data.arrowDirection === 'left' ? '<<<' : '>>>';

  // Physical label dimensions
  const labelWidth = 812; // 4" = physical width (becomes visual height)
  const labelHeight = 406; // 2" = physical height (becomes visual width)

  // Layout dimensions
  const margin = 10;
  const headerWidth = 80; // Width of bay header bar
  const arrowWidth = 60; // Width of arrow section

  // Position header at RIGHT edge (becomes TOP when applied)
  const headerX = labelWidth - margin - headerWidth;

  // Position arrow at LEFT edge (becomes BOTTOM when applied)
  const arrowX = margin;

  // Content area between arrow and header
  const contentStart = arrowX + arrowWidth + 5;
  const contentEnd = headerX - 5;
  const contentArea = contentEnd - contentStart;

  // Calculate level spacing
  const levelCount = Math.min(data.levels.length, 5);
  const levelWidth = Math.floor(contentArea / levelCount);

  let zpl = `^XA

^FX -- Compact Totem: ${bayCode} --
^FX -- Right edge = TOP when applied, Left edge = BOTTOM --

^FX === BAY HEADER (right edge → TOP when applied) ===
^FO${headerX},${margin}
^GB${headerWidth},${labelHeight - margin * 2},${headerWidth},B^FS

^FO${headerX + 15},${margin + 15}
^A0R,44,44
^FR
^FDBay ${bayCode}^FS

`;

  // Add each level - highest level first (closest to header = highest X)
  // Levels go from right to left in physical space (top to bottom when applied)
  data.levels.slice(0, 5).forEach((level, index) => {
    // Start from near header and work toward arrow
    const xPos = contentEnd - (index + 1) * levelWidth;
    const locationCode = `${data.aisle}-${data.bay}-${level.level}`;
    const levelNum = parseInt(level.level, 10);
    const levelText = levelNum === 0 ? 'FLR' : `L${levelNum}`;
    const forkliftText = level.requiresForklift ? '[F]' : '';

    zpl += `
^FX -- Level ${level.level} --

^FX QR Code
^FO${xPos + 10},${margin + 5}
^BQN,2,2
^FDMA,${level.barcode}^FS

^FX Location code
^FO${xPos + 10},${margin + 95}
^A0R,20,20
^FD${escapeZpl(locationCode)}^FS

^FX Level + forklift
^FO${xPos + 32},${margin + 95}
^A0R,18,18
^FD${levelText} ${forkliftText}^FS

^FX Separator line
^FO${xPos},${margin}
^GB1,${labelHeight - margin * 2},1^FS
`;
  });

  // Arrow at LEFT edge (becomes BOTTOM when applied)
  zpl += `
^FX === DIRECTION ARROW (left edge → BOTTOM when applied) ===
^FO${arrowX},${margin}
^GB${arrowWidth},${labelHeight - margin * 2},${arrowWidth},B^FS

^FO${arrowX + 8},${Math.floor(labelHeight / 2) - 40}
^A0R,60,60
^FR
^FD${arrow}^FS

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
