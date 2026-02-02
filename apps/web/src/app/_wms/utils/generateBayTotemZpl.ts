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
 *       { level: '01', barcode: 'LOC-A-01-01', requiresForklift: true },
 *       { level: '00', barcode: 'LOC-A-01-00', requiresForklift: false },
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
 * - Header: Bay identifier (A-01)
 * - 4 level sections, each with:
 *   - QR code on left
 *   - Location code and level text on right
 *   - Forklift indicator if needed
 *   - Horizontal separator line
 */
const generateBayTotemZpl = (data: BayTotemData) => {
  const bayCode = `${escapeZpl(data.aisle)}-${escapeZpl(data.bay)}`;

  // Calculate section height - 6" label at 203 DPI = 1218 dots
  // Header: ~150 dots, each level section: ~250 dots
  const headerHeight = 120;
  const sectionHeight = 270;

  let zpl = `^XA

^FX -- Bay Header --
^FO30,30
^A0N,70,70
^FDBay ${bayCode}^FS

^FO30,100
^GB750,3,3^FS
`;

  // Add each level section (from top level to bottom)
  data.levels.forEach((level, index) => {
    const yOffset = headerHeight + (index * sectionHeight);
    const locationCode = `${data.aisle}-${data.bay}-${level.level}`;
    const levelNum = parseInt(level.level, 10);
    const levelLabel = levelNum === 0 ? 'FLOOR' : `LEVEL ${levelNum}`;
    const forkliftText = level.requiresForklift ? 'FORKLIFT' : '';

    zpl += `
^FX -- Level ${level.level} Section --

^FX QR Code
^FO30,${yOffset + 20}
^BQN,2,5
^FDMA,${level.barcode}^FS

^FX Location Code (large)
^FO200,${yOffset + 30}
^A0N,60,60
^FD${escapeZpl(locationCode)}^FS

^FX Level Label
^FO200,${yOffset + 100}
^A0N,40,40
^FD${levelLabel}^FS

^FX Forklift indicator
^FO450,${yOffset + 100}
^A0N,32,32
^FD${forkliftText}^FS

^FX Separator line
^FO30,${yOffset + 160}
^GB750,2,2^FS
`;
  });

  // Add mounting instruction at bottom
  const bottomY = headerHeight + (data.levels.length * sectionHeight);
  zpl += `
^FX -- Mounting instruction --
^FO200,${bottomY + 10}
^A0N,24,24
^FDMount at eye level (1.5m)^FS

^XZ`;

  return zpl;
};

/**
 * Generate ZPL for multiple bay totems (batch printing)
 */
export const generateBatchBayTotemsZpl = (totems: BayTotemData[]) => {
  return totems.map(generateBayTotemZpl).join('\n');
};

export default generateBayTotemZpl;
