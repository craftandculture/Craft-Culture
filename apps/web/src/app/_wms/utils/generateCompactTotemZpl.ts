/**
 * Generate ZPL for a Compact Bay Totem - vertical strip on 4x2 label
 *
 * Designed for 4" x 2" labels printed in portrait orientation
 * Uses ^PW (Print Width) and ^LL (Label Length) to force portrait mode
 *
 * Physical label: 4" x 2" (fed through printer as 4" wide)
 * Print area: 2" x 4" (portrait orientation)
 *
 * @example
 *   generateCompactTotemZpl({
 *     aisle: 'A',
 *     bay: '01',
 *     levels: [
 *       { level: '04', barcode: 'LOC-A-01-04', requiresForklift: true },
 *       { level: '03', barcode: 'LOC-A-01-03', requiresForklift: true },
 *       { level: '02', barcode: 'LOC-A-01-02', requiresForklift: true },
 *       { level: '01', barcode: 'LOC-A-01-01', requiresForklift: false },
 *       { level: '00', barcode: 'LOC-A-01-00', requiresForklift: false },
 *     ],
 *     arrowDirection: 'right',
 *   });
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
 * Uses rotation approach: content is designed for 2" wide x 4" tall (portrait)
 * but printed on 4" x 2" label with 90-degree rotation
 *
 * At 203 DPI:
 * - 2" = 406 dots (width when held vertically)
 * - 4" = 812 dots (height when held vertically)
 */
const generateCompactTotemZpl = (data: CompactTotemData) => {
  const bayCode = `${escapeZpl(data.aisle)}-${escapeZpl(data.bay)}`;
  const arrow = data.arrowDirection === 'left' ? '<' : '>';

  // Physical label is 4" wide x 2" tall at 203 DPI = 812 x 406 dots
  // We rotate content 90° so it appears as 2" wide x 4" tall when peeled
  const labelWidth = 812; // Physical width (4")
  const labelHeight = 406; // Physical height (2")

  // Content dimensions (rotated) - labelHeight becomes visual width, labelWidth becomes visual height
  const contentHeight = labelWidth; // 812 dots = 4" visual height

  // Calculate row dimensions
  const headerHeight = 70;
  const arrowHeight = 50;
  const availableHeight = contentHeight - headerHeight - arrowHeight - 20;
  const levelCount = Math.min(data.levels.length, 5);
  const rowHeight = Math.floor(availableHeight / levelCount);

  // Start ZPL - using rotation (^FWR) for all content
  let zpl = `^XA

^FX -- Compact Totem for 4x2 label (portrait when peeled) --
^FX -- All content rotated 90 degrees using ^FWR --

^FWR
^CF0,28

^FX -- Bay Header with black background --
^FO${labelHeight - headerHeight},10
^GB${headerHeight},${labelWidth - 20},${headerHeight},B^FS

^FX -- Bay Header Text (white on black) --
^FO${labelHeight - headerHeight + 15},30
^A0R,50,50
^FR
^FDBay ${bayCode}^FS

`;

  // Add each level (rotated coordinates)
  data.levels.slice(0, 5).forEach((level, index) => {
    const xPos = labelHeight - headerHeight - 10 - (index + 1) * rowHeight;
    const locationCode = `${data.aisle}-${data.bay}-${level.level}`;
    const levelNum = parseInt(level.level, 10);
    const levelText = levelNum === 0 ? 'FLOOR' : `LVL ${levelNum}`;
    const forkliftText = level.requiresForklift ? ' [F]' : '';

    zpl += `
^FX -- Level ${level.level} Row --

^FX QR Code (rotated)
^FO${xPos + rowHeight - 75},15
^BQN,2,2
^FDMA,${level.barcode}^FS

^FX Location code and level info
^FO${xPos + rowHeight - 30},100
^A0R,24,24
^FD${escapeZpl(locationCode)}^FS

^FO${xPos + rowHeight - 58},100
^A0R,20,20
^FD${levelText}${forkliftText}^FS

^FX Row separator line
^FO${xPos},15
^GB1,${labelWidth - 30},1^FS
`;
  });

  // Arrow at bottom (which is left side in rotated view)
  const arrowX = 10;
  zpl += `
^FX -- Direction Arrow --
^FO${arrowX},${Math.floor(labelWidth / 2) - 60}
^A0R,80,80
^FD${arrow}${arrow}${arrow}^FS

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
