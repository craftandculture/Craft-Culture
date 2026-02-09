/**
 * Generate ZPL for a Compact Bay Totem - vertical strip on 4x2 label
 *
 * Design inspired by Camcode warehouse rack labels:
 * - Large bold level numbers in black boxes
 * - QR code next to level indicator
 * - Location code as secondary text
 * - Clean horizontal bands for each level
 * - Graphical direction arrow at bottom
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
 * Generate a graphical arrow pointing up or down (when label is applied vertically)
 * Arrow is drawn using diagonal lines to create a triangle shape
 *
 * Physical orientation: arrow points LEFT (low X) or RIGHT (high X)
 * When applied vertically: LEFT becomes DOWN, RIGHT becomes UP
 *
 * @param x - X position for arrow center
 * @param y - Y position for arrow
 * @param direction - 'left' points down when applied, 'right' points up when applied
 * @param size - Arrow size in dots
 */
const generateArrowZpl = (
  x: number,
  y: number,
  direction: 'left' | 'right',
  size: number
) => {
  const centerY = y + size / 2;
  let zpl = '';

  // Draw arrow using stacked horizontal lines forming a triangle
  // For 'right' direction (points UP when applied): triangle points to high X
  // For 'left' direction (points DOWN when applied): triangle points to low X
  const steps = Math.floor(size / 6);

  for (let i = 0; i < steps; i++) {
    const lineWidth = (i + 1) * 6;
    const lineY = centerY - lineWidth / 2;

    if (direction === 'right') {
      // Arrow pointing right (UP when applied) - lines get wider toward high X
      const lineX = x + i * 6;
      zpl += `^FO${lineX},${lineY}^GB6,${lineWidth},6,B^FS\n`;
    } else {
      // Arrow pointing left (DOWN when applied) - lines get wider toward low X
      const lineX = x + size - (i + 1) * 6;
      zpl += `^FO${lineX},${lineY}^GB6,${lineWidth},6,B^FS\n`;
    }
  }

  // Add arrow shaft (rectangle)
  const shaftWidth = Math.floor(size * 0.6);
  const shaftHeight = Math.floor(size * 0.3);
  const shaftY = centerY - shaftHeight / 2;

  if (direction === 'right') {
    zpl += `^FO${x - shaftWidth},${shaftY}^GB${shaftWidth},${shaftHeight},${shaftHeight},B^FS\n`;
  } else {
    zpl += `^FO${x + size},${shaftY}^GB${shaftWidth},${shaftHeight},${shaftHeight},B^FS\n`;
  }

  return zpl;
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
 * Layout (when applied vertically):
 * ┌──────────────────────────┐
 * │ Bay A-01  (thin header)  │ ← TOP
 * ├──────────────────────────┤
 * │ [04] [QR] A-01-04       │
 * ├──────────────────────────┤
 * │ [03] [QR] A-01-03       │
 * ├──────────────────────────┤
 * │ [02] [QR] A-01-02       │
 * ├──────────────────────────┤
 * │ [01] [QR] A-01-01       │
 * ├──────────────────────────┤
 * │ [00] [QR] A-01-00       │
 * ├──────────────────────────┤
 * │      ↓ or ↑ Arrow       │ ← BOTTOM
 * └──────────────────────────┘
 */
const generateCompactTotemZpl = (data: CompactTotemData) => {
  const bayCode = `${escapeZpl(data.aisle)}-${escapeZpl(data.bay)}`;

  // Physical label dimensions
  const labelWidth = 812; // 4" = physical width (becomes visual height)
  const labelHeight = 406; // 2" = physical height (becomes visual width)

  // Layout dimensions
  const margin = 8;
  const headerHeight = 50; // Thin header strip at top
  const arrowHeight = data.arrowDirection ? 55 : 0; // Arrow section at bottom

  // Level row dimensions
  const levelCount = Math.min(data.levels.length, 5);
  const contentArea = labelWidth - margin * 2 - headerHeight - arrowHeight;
  const rowHeight = Math.floor(contentArea / levelCount);

  // Column widths within each row (visual: left to right when applied)
  const levelBoxWidth = 70; // Black box with level number
  const qrSize = 3; // QR magnification (larger = bigger)

  let zpl = `^XA

^FX -- Compact Totem: ${bayCode} (Camcode-inspired design) --

^FX === OUTER BORDER ===
^FO${margin},${margin}
^GB${labelWidth - margin * 2},${labelHeight - margin * 2},3^FS

^FX === BAY HEADER (thin strip at top) ===
^FO${labelWidth - margin - headerHeight},${margin}
^GB${headerHeight},${labelHeight - margin * 2},${headerHeight},B^FS

^FO${labelWidth - margin - headerHeight + 8},${Math.floor(labelHeight / 2) - 50}
^A0R,36,36
^FR
^FDBay^FS

^FO${labelWidth - margin - headerHeight + 8},${Math.floor(labelHeight / 2) + 10}
^A0R,36,36
^FR
^FD${bayCode}^FS

`;

  // Add each level - highest level first (closest to header = highest X)
  data.levels.slice(0, 5).forEach((level, index) => {
    // Position from header downward (high X to low X in physical space)
    const rowX =
      labelWidth - margin - headerHeight - (index + 1) * rowHeight - 3;
    const levelNum = parseInt(level.level, 10);
    const levelText = levelNum === 0 ? '00' : String(levelNum).padStart(2, '0');
    const locationCode = `${data.aisle}-${data.bay}-${level.level}`;
    const forkliftIndicator = level.requiresForklift ? 'F' : '';

    zpl += `
^FX -- Level ${level.level} Row --

^FX Level number in black box (left side when applied)
^FO${rowX + rowHeight - levelBoxWidth},${margin + 3}
^GB${levelBoxWidth},${labelHeight - margin * 2 - 6},${levelBoxWidth},B^FS

^FO${rowX + rowHeight - levelBoxWidth + 12},${Math.floor(labelHeight / 2) - 35}
^A0R,70,70
^FR
^FD${levelText}^FS

${
  forkliftIndicator
    ? `^FX Forklift indicator badge
^FO${rowX + rowHeight - levelBoxWidth + 12},${labelHeight - margin - 60}
^GB50,45,45,B,3^FS
^FO${rowX + rowHeight - levelBoxWidth + 20},${labelHeight - margin - 50}
^A0R,28,28
^FR
^FDF^FS
`
    : ''
}
^FX QR Code (center when applied)
^FO${rowX + 12},${margin + 20}
^BQN,2,${qrSize}
^FDMA,${level.barcode}^FS

^FX Location code (right side when applied)
^FO${rowX + 12},${margin + 145}
^A0R,26,26
^FD${escapeZpl(locationCode)}^FS

^FX Separator line between rows
^FO${rowX},${margin}
^GB3,${labelHeight - margin * 2},3^FS
`;
  });

  // Arrow section at bottom (if direction specified)
  if (data.arrowDirection) {
    const arrowX = margin + 5;
    const arrowY = Math.floor(labelHeight / 2) - 25;
    const arrowSize = 50;

    zpl += `
^FX === DIRECTION ARROW (bottom when applied) ===
^FO${arrowX},${margin}
^GB${arrowHeight},${labelHeight - margin * 2},3^FS

${generateArrowZpl(arrowX + 5, arrowY, data.arrowDirection, arrowSize)}
`;
  }

  zpl += `^XZ`;

  return zpl;
};

/**
 * Generate ZPL for multiple compact totems (batch printing)
 */
export const generateBatchCompactTotemsZpl = (totems: CompactTotemData[]) => {
  return totems.map(generateCompactTotemZpl).join('\n');
};

export default generateCompactTotemZpl;
