/**
 * Generate a LWIN-18 code from product details
 * Format: LWIN11-VINTAGE-CASECONFIG-BOTTLESIZE
 *
 * If LWIN11 is not available, generates a hash from product name and producer
 *
 * @example
 *   generateLwin18({ productName: 'Château Margaux', vintage: 2015, bottlesPerCase: 6, bottleSizeMl: 750 });
 *   // returns '1010279-2015-06-00750' (if LWIN available) or 'XXXXXXX-2015-06-00750'
 *
 * @param params - Product details
 * @returns The generated LWIN-18 code
 */
const generateLwin18 = (params: {
  productName: string;
  producer?: string;
  vintage?: number;
  bottlesPerCase?: number;
  bottleSizeMl?: number;
}) => {
  const { productName, producer, vintage, bottlesPerCase = 12, bottleSizeMl = 750 } = params;

  // Generate a simple hash from product name and producer for the LWIN11 portion
  // In a production system, this would look up the actual LWIN database
  const text = `${productName}-${producer || ''}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const lwin11 = Math.abs(hash).toString().slice(0, 7).padStart(7, '0');

  // Vintage (4 digits) - use 0000 for NV (non-vintage)
  const vintageStr = vintage ? vintage.toString() : '0000';

  // Case config (2 digits)
  const caseConfig = bottlesPerCase.toString().padStart(2, '0');

  // Bottle size (5 digits, in ml)
  const bottleSize = bottleSizeMl.toString().padStart(5, '0');

  return `${lwin11}-${vintageStr}-${caseConfig}-${bottleSize}`;
};

export default generateLwin18;
