/**
 * Generate a barcode for a warehouse location
 *
 * @example
 *   generateLocationBarcode('A', '01', '02'); // returns 'LOC-A-01-02'
 *
 * @param aisle - The aisle identifier (e.g., 'A', 'B')
 * @param bay - The bay number (e.g., '01', '02')
 * @param level - The level number (e.g., '00', '01', '02')
 */
const generateLocationBarcode = (aisle: string, bay: string, level: string) => {
  return `LOC-${aisle.toUpperCase()}-${bay}-${level}`;
};

export default generateLocationBarcode;
