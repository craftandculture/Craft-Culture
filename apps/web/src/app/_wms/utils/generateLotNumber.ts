/**
 * Generate a lot number for incoming stock
 * Format: YYYY-MM-DD-NNN where NNN is a sequence number
 *
 * @example
 *   generateLotNumber(1); // returns '2026-01-31-001'
 *   generateLotNumber(5); // returns '2026-01-31-005'
 *
 * @param sequence - The sequence number for this lot (for multiple shipments on same day)
 * @returns The generated lot number
 */
const generateLotNumber = (sequence: number = 1) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}-${sequence.toString().padStart(3, '0')}`;
};

export default generateLotNumber;
