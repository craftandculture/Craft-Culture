/**
 * Generate ZPL (Zebra Programming Language) code for a location/rack label with QR code
 *
 * Designed for 4" x 2" (100mm x 50mm) direct thermal labels on Zebra ZD421 printer
 * Uses QR code for fast scanning from multiple angles
 *
 * @example
 *   generateLocationLabelZpl({
 *     barcode: 'LOC-A-01-02',
 *     locationCode: 'A-01-02',
 *     aisle: 'A',
 *     bay: '01',
 *     level: '02',
 *     locationType: 'rack',
 *     requiresForklift: true,
 *   });
 */

export interface LocationLabelData {
  /** Location barcode (e.g., LOC-A-01-02) */
  barcode: string;
  /** Location code without prefix (e.g., A-01-02) */
  locationCode: string;
  /** Aisle identifier (e.g., A) */
  aisle: string;
  /** Bay number (e.g., 01) */
  bay: string;
  /** Level number (e.g., 02) */
  level: string;
  /** Location type */
  locationType: 'rack' | 'floor' | 'receiving' | 'shipping';
  /** Whether forklift is required to access */
  requiresForklift?: boolean | null;
}

/**
 * Escape special characters for ZPL
 */
const escapeZpl = (str: string) => {
  return str.replace(/\^/g, ' ').replace(/~/g, ' ');
};

/**
 * Get display text for location type
 */
const getLocationTypeDisplay = (type: string) => {
  const types: Record<string, string> = {
    rack: 'RACK',
    floor: 'FLOOR',
    receiving: 'RECEIVING',
    shipping: 'SHIPPING',
  };
  return types[type] || type.toUpperCase();
};

/**
 * Generate ZPL code for a single location label with QR code
 *
 * Label layout (4" x 2" at 203 DPI = 812 x 406 dots):
 * - Left: Large QR code containing barcode data
 * - Right: Location code in large text (A-01-02)
 * - Bottom: Breakdown (Aisle / Bay / Level) and type/forklift info
 */
const generateLocationLabelZpl = (data: LocationLabelData) => {
  const locationCode = escapeZpl(data.locationCode);
  const locationType = getLocationTypeDisplay(data.locationType);
  const forkliftText = data.requiresForklift ? 'FORKLIFT' : '';

  // ZPL code for 4" x 2" label at 203 DPI
  // ^XA = Start format
  // ^BQ = QR Code (N=normal, 2=model 2, magnification)
  // ^FD = Field data (MA = alphanumeric mode, then comma, then data)
  // ^A0 = Scalable font
  // ^XZ = End format
  const zpl = `^XA

^FX -- QR Code on left side --
^FO30,30
^BQN,2,7
^FDMA,${data.barcode}^FS

^FX -- Large location code on right --
^FO220,40
^A0N,90,90
^FD${locationCode}^FS

^FX -- Breakdown labels --
^FO220,150
^A0N,28,28
^FDAisle^FS

^FO340,150
^A0N,28,28
^FDBay^FS

^FO450,150
^A0N,28,28
^FDLevel^FS

^FX -- Breakdown values --
^FO230,185
^A0N,50,50
^FD${escapeZpl(data.aisle)}^FS

^FO345,185
^A0N,50,50
^FD${escapeZpl(data.bay)}^FS

^FO455,185
^A0N,50,50
^FD${escapeZpl(data.level)}^FS

^FX -- Location type --
^FO30,250
^A0N,32,32
^FD${locationType}^FS

^FX -- Forklift indicator (if required) --
^FO250,250
^A0N,32,32
^FD${forkliftText}^FS

^XZ`;

  return zpl;
};

/**
 * Generate ZPL for multiple location labels (batch printing)
 *
 * @param labels - Array of location label data
 * @returns Combined ZPL string for all labels
 */
export const generateBatchLocationLabelsZpl = (labels: LocationLabelData[]) => {
  return labels.map(generateLocationLabelZpl).join('\n');
};

export default generateLocationLabelZpl;
