/**
 * Parse bottle size string to centiliters
 *
 * @example
 *   parseBottleSizeToCl('750ml'); // returns 75
 *   parseBottleSizeToCl('1.5L'); // returns 150
 *   parseBottleSizeToCl('75cl'); // returns 75
 */
const parseBottleSizeToCl = (bottleSize: string | null | undefined): number | null => {
  if (!bottleSize) return null;

  const normalized = bottleSize.toLowerCase().trim();

  // Handle ml format (e.g., "750ml", "750 ml")
  const mlMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*ml$/);
  if (mlMatch && mlMatch[1]) {
    return Math.round(parseFloat(mlMatch[1]) / 10);
  }

  // Handle cl format (e.g., "75cl", "75 cl")
  const clMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*cl$/);
  if (clMatch && clMatch[1]) {
    return Math.round(parseFloat(clMatch[1]));
  }

  // Handle L format (e.g., "1.5L", "1.5 L", "1L")
  const lMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*l$/);
  if (lMatch && lMatch[1]) {
    return Math.round(parseFloat(lMatch[1]) * 100);
  }

  return null;
};

/**
 * Format LWIN-18 from component parts
 *
 * LWIN-18 structure:
 * - Digits 1-7: Base LWIN (wine identifier)
 * - Digits 8-11: Vintage year
 * - Digits 12-15: Bottle size in centiliters (e.g., 0075 for 75cl/750ml)
 * - Digits 16-18: Pack quantity (e.g., 006 for 6-pack)
 *
 * @example
 *   formatLwin18({
 *     lwin: '1234567',
 *     vintage: '2018',
 *     bottleSize: '750ml',
 *     caseConfig: 6,
 *   });
 *   // returns '123456720180075006'
 *
 * @example
 *   formatLwin18({
 *     lwin: '1234567',
 *     vintage: '2018',
 *   });
 *   // returns '12345672018' (LWIN-11 if no package info)
 */
const formatLwin18 = ({
  lwin,
  vintage,
  bottleSize,
  caseConfig,
}: {
  lwin: string | null | undefined;
  vintage: string | null | undefined;
  bottleSize?: string | null;
  caseConfig?: number | string | null;
}): string | null => {
  if (!lwin) return null;

  // Start with base LWIN-7
  let result = lwin;

  // Extract 4-digit year from vintage (handles "2018", "2018/2019", etc.)
  if (vintage) {
    const yearMatch = vintage.match(/\b(19|20)\d{2}\b/);
    if (yearMatch && yearMatch[0]) {
      result += yearMatch[0];
    }
  }

  // If we have package info, add the 7-digit package code
  const bottleCl = parseBottleSizeToCl(bottleSize);
  const packQty = typeof caseConfig === 'string'
    ? parseInt(caseConfig, 10)
    : caseConfig;

  if (bottleCl !== null && packQty && !isNaN(packQty)) {
    // Format: 4-digit bottle size (cl) + 3-digit pack quantity
    const bottleCode = bottleCl.toString().padStart(4, '0');
    const packCode = packQty.toString().padStart(3, '0');
    result += bottleCode + packCode;
  }

  return result;
};

export default formatLwin18;
