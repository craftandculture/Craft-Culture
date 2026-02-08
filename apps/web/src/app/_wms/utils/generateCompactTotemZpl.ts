/**
 * Generate ZPL for a Compact Bay Totem - vertical strip on 4x2 label (rotated to 2x4)
 *
 * Designed for 4" x 2" labels printed in portrait orientation (2" x 4")
 * Fits on standard label stock, smaller QR codes but still scannable
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
 * Generate ZPL for a compact vertical totem (2" x 4" portrait)
 *
 * Label dimensions at 203 DPI:
 * - Width: 2" = 406 dots
 * - Height: 4" = 812 dots
 *
 * Uses ^POI (Print Orientation Inverted) to rotate content
 */
const generateCompactTotemZpl = (data: CompactTotemData) => {
  const bayCode = `${escapeZpl(data.aisle)}-${escapeZpl(data.bay)}`;
  const arrow = data.arrowDirection === 'left' ? '<--' : '-->';

  // Calculate row height based on number of levels (max 5 levels for good sizing)
  const headerHeight = 90;
  const arrowHeight = 60;
  const availableHeight = 812 - headerHeight - arrowHeight;
  const levelCount = Math.min(data.levels.length, 5);
  const rowHeight = Math.floor(availableHeight / levelCount);

  let zpl = `^XA

^FX -- Print in portrait mode (rotate 90 degrees) --
^PON

^FX -- Label size: 2" x 4" at 203 DPI = 406 x 812 dots --

^FX -- Outer border --
^FO10,10
^GB386,792,3^FS

^FX -- Bay Header with black background --
^FO15,15
^GB376,70,70,B^FS

^FX -- Bay Header Text (white on black) --
^FO30,25
^A0N,55,55
^FR
^FDBay ${bayCode}^FS

^FX -- Header separator --
^FO15,90
^GB376,3,3^FS
`;

  // Add each level (from top to bottom - highest level first)
  data.levels.slice(0, 5).forEach((level, index) => {
    const yOffset = headerHeight + 5 + (index * rowHeight);
    const locationCode = `${data.aisle}-${data.bay}-${level.level}`;
    const levelNum = parseInt(level.level, 10);
    const forkliftIcon = level.requiresForklift ? '*' : '';

    zpl += `
^FX -- Level ${level.level} Row --

^FX QR Code (small, magnification 3)
^FO25,${yOffset + 5}
^BQN,2,3
^FDMA,${level.barcode}^FS

^FX Location code
^FO120,${yOffset + 10}
^A0N,36,36
^FD${escapeZpl(locationCode)}^FS

^FX Level number and forklift indicator
^FO120,${yOffset + 50}
^A0N,28,28
^FD${levelNum === 0 ? 'FLOOR' : 'LVL ' + levelNum}${forkliftIcon ? '  [F]' : ''}^FS

^FX Row separator
^FO20,${yOffset + rowHeight - 5}
^GB366,1,1^FS
`;
  });

  // Arrow at bottom
  const arrowY = 812 - arrowHeight;
  zpl += `
^FX -- Direction Arrow --
^FO15,${arrowY}
^GB376,${arrowHeight - 15},${arrowHeight - 15},B^FS

^FO100,${arrowY + 8}
^A0N,40,40
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
