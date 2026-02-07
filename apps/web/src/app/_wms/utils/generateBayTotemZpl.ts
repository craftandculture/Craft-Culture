/**
 * Generate ZPL for a Bay Totem label - vertical strip showing all levels for one bay
 *
 * Designed for 4" x 6" (100mm x 150mm) direct thermal labels on Zebra ZD421
 * Mount at eye level (~1.5m) on the upright column
 * All 4 level QR codes scannable from standing position
 *
 * @example
 *   generateBayTotemZpl({
 *     aisle: 'A',
 *     bay: '01',
 *     levels: [
 *       { level: '03', barcode: 'LOC-A-01-03', requiresForklift: true },
 *       { level: '02', barcode: 'LOC-A-01-02', requiresForklift: true },
 *       { level: '01', barcode: 'LOC-A-01-01', requiresForklift: false },  // Floor level (bay splits)
 *       { level: '00', barcode: 'LOC-A-01-00', requiresForklift: false },  // Floor level
 *     ],
 *   });
 */

export interface TotemLevel {
  /** Level number (e.g., '00', '01', '02', '03') */
  level: string;
  /** Full barcode (e.g., 'LOC-A-01-02') */
  barcode: string;
  /** Whether forklift is required */
  requiresForklift?: boolean | null;
}

export interface BayTotemData {
  /** Aisle identifier (e.g., 'A') */
  aisle: string;
  /** Bay number (e.g., '01') */
  bay: string;
  /** Levels from top to bottom (highest first) */
  levels: TotemLevel[];
}

/**
 * Escape special characters for ZPL
 */
const escapeZpl = (str: string) => {
  return str.replace(/\^/g, ' ').replace(/~/g, ' ');
};

/**
 * Generate ZPL code for a single bay totem label
 *
 * Label layout (4" x 6" at 203 DPI = 812 x 1218 dots):
 * - Header: Bay identifier in large bold text with border
 * - 4 level sections, each with:
 *   - Large QR code on left
 *   - Location code and level text on right
 *   - Visual badges for forklift indicator
 *   - Clean separator lines
 */
const generateBayTotemZpl = (data: BayTotemData) => {
  const bayCode = `${escapeZpl(data.aisle)}-${escapeZpl(data.bay)}`;

  // Calculate section height - 6" label at 203 DPI = 1218 dots
  // Header: ~150 dots, each level section: ~260 dots
  const headerHeight = 140;
  const sectionHeight = 260;

  let zpl = `^XA

^FX -- Outer border --
^FO15,15
^GB782,1188,3^FS

^FX -- Bay Header with background box --
^FO25,25
^GB762,110,110,B^FS

^FX -- Bay Header Text (reversed/white on black) --
^FO60,45
^A0N,80,80
^FR
^FDBay ${bayCode}^FS

^FX -- Header separator --
^FO25,140
^GB762,4,4^FS
`;

  // Add each level section (from top level to bottom)
  data.levels.forEach((level, index) => {
    const yOffset = headerHeight + (index * sectionHeight);
    const locationCode = `${data.aisle}-${data.bay}-${level.level}`;
    const levelNum = parseInt(level.level, 10);
    const levelLabel = levelNum <= 1 ? 'FLOOR' : `LEVEL ${levelNum}`;
    const forkliftText = level.requiresForklift ? 'FORKLIFT' : '';

    zpl += `
^FX -- Level ${level.level} Section --

^FX Large QR Code (magnification 7 for easy scanning)
^FO40,${yOffset + 20}
^BQN,2,7
^FDMA,${level.barcode}^FS

^FX Location Code (large and bold)
^FO260,${yOffset + 25}
^A0N,70,70
^FD${escapeZpl(locationCode)}^FS

^FX Level Label
^FO260,${yOffset + 105}
^A0N,45,45
^FD${levelLabel}^FS

^FX Forklift badge (if required)
${forkliftText ? `^FO260,${yOffset + 160}
^GB150,40,2^FS
^FO270,${yOffset + 168}
^A0N,26,26
^FD${forkliftText}^FS` : ''}

^FX Separator line
^FO25,${yOffset + 215}
^GB762,2,2^FS
`;
  });

  zpl += `^XZ`;

  return zpl;
};

/**
 * Generate ZPL for multiple bay totems (batch printing)
 */
export const generateBatchBayTotemsZpl = (totems: BayTotemData[]) => {
  return totems.map(generateBayTotemZpl).join('\n');
};

export default generateBayTotemZpl;
