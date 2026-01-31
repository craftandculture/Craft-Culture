/**
 * Generate a location code for a warehouse location
 *
 * @example
 *   generateLocationCode('A', '01', '02'); // returns 'A-01-02'
 *
 * @param aisle - The aisle identifier (e.g., 'A', 'B')
 * @param bay - The bay number (e.g., '01', '02')
 * @param level - The level number (e.g., '00', '01', '02')
 */
const generateLocationCode = (aisle: string, bay: string, level: string) => {
  return `${aisle.toUpperCase()}-${bay}-${level}`;
};

export default generateLocationCode;
