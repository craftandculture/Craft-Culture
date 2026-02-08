/**
 * Generate ZPL for a Compact Bay Totem - vertical strip on 4x2 label
 *
 * Physical label: 4" x 2" at 203 DPI = 812 x 406 dots
 * When applied vertically: 2" wide x 4" tall
 *
 * Content is rotated 90° so when the label is peeled and applied
 * vertically, it reads top-to-bottom correctly.
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
 * Physical dimensions at 203 DPI:
 * - Label width: 4" = 812 dots (becomes height when applied vertically)
 * - Label height: 2" = 406 dots (becomes width when applied vertically)
 *
 * Uses ^A0R for rotated text (90° clockwise)
 * Coordinates are in physical label space (0,0 = top-left corner as printed)
 */
const generateCompactTotemZpl = (data: CompactTotemData) => {
  const bayCode = `${escapeZpl(data.aisle)}-${escapeZpl(data.bay)}`;
  const arrow = data.arrowDirection === 'left' ? '<<<' : '>>>';

  // Physical label dimensions
  const labelWidth = 812; // 4" physical width (becomes visual height)
  const labelHeight = 406; // 2" physical height (becomes visual width)

  // Layout calculations - content fills most of the label
  const margin = 15;
  const headerWidth = 70; // Width of black header bar (in physical X)
  const arrowWidth = 50; // Width of arrow section
  const contentStart = margin + headerWidth + 5;
  const contentEnd = labelWidth - margin - arrowWidth;
  const contentArea = contentEnd - contentStart;

  // Calculate level spacing
  const levelCount = Math.min(data.levels.length, 5);
  const levelWidth = Math.floor(contentArea / levelCount);

  let zpl = `^XA

^FX -- Compact Totem: ${bayCode} --
^FX -- Physical 4x2 label, content rotated for vertical application --

^FX === BAY HEADER (black bar at top when applied) ===
^FO${margin},${margin}
^GB${headerWidth},${labelHeight - margin * 2},${headerWidth},B^FS

^FO${margin + 10},${margin + 20}
^A0R,48,48
^FR
^FDBay ${bayCode}^FS

`;

  // Add each level - highest level first (closest to header)
  data.levels.slice(0, 5).forEach((level, index) => {
    const xPos = contentStart + index * levelWidth;
    const locationCode = `${data.aisle}-${data.bay}-${level.level}`;
    const levelNum = parseInt(level.level, 10);
    const levelText = levelNum === 0 ? 'FLOOR' : `LVL ${levelNum}`;
    const forkliftText = level.requiresForklift ? ' [F]' : '';

    // QR code size 2 = ~42 dots, position centered in row
    const qrSize = 2;

    zpl += `
^FX -- Level ${level.level} --

^FX QR Code
^FO${xPos + 5},${margin + 10}
^BQN,2,${qrSize}
^FDMA,${level.barcode}^FS

^FX Location code (rotated text)
^FO${xPos + 5},${margin + 100}
^A0R,22,22
^FD${escapeZpl(locationCode)}^FS

^FX Level indicator
^FO${xPos + 30},${margin + 100}
^A0R,18,18
^FD${levelText}${forkliftText}^FS

^FX Separator line (vertical in physical space = horizontal when applied)
^FO${xPos + levelWidth - 2},${margin + 5}
^GB1,${labelHeight - margin * 2 - 10},1^FS
`;
  });

  // Arrow at bottom (right edge in physical = bottom when applied vertically)
  zpl += `
^FX === DIRECTION ARROW (bottom when applied) ===
^FO${labelWidth - margin - arrowWidth},${margin}
^GB${arrowWidth - 5},${labelHeight - margin * 2},${arrowWidth - 5},B^FS

^FO${labelWidth - margin - arrowWidth + 5},${Math.floor(labelHeight / 2) - 30}
^A0R,50,50
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
