/**
 * Generate a unique order number for private client orders
 *
 * Format: PCO-YYYY-XXXXX (e.g., PCO-2025-00001)
 *
 * @param sequenceNumber - The sequence number for this year
 * @returns The formatted order number
 */
const generateOrderNumber = (sequenceNumber: number) => {
  const year = new Date().getFullYear();
  const paddedSequence = String(sequenceNumber).padStart(5, '0');
  return `PCO-${year}-${paddedSequence}`;
};

export default generateOrderNumber;
