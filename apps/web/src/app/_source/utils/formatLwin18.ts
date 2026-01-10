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
 * Parse case config to extract pack quantity
 * Handles formats like: 6, "6", "6x75cl", "12 x 750ml"
 */
const parseCaseConfigToQty = (caseConfig: number | string | null | undefined): number | null => {
  if (caseConfig === null || caseConfig === undefined) return null;

  if (typeof caseConfig === 'number') {
    return caseConfig;
  }

  // Try to extract the quantity from strings like "6x75cl", "12 x 750ml"
  const match = caseConfig.match(/^(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  return null;
};

/**
 * Parse bottle size string to milliliters
 *
 * @example
 *   parseBottleSizeToMl('750ml'); // returns 750
 *   parseBottleSizeToMl('1.5L'); // returns 1500
 *   parseBottleSizeToMl('75cl'); // returns 750
 */
const parseBottleSizeToMl = (bottleSize: string | null | undefined): number | null => {
  if (!bottleSize) return null;

  const normalized = bottleSize.toLowerCase().trim();

  // Handle ml format (e.g., "750ml", "750 ml")
  const mlMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*ml$/);
  if (mlMatch && mlMatch[1]) {
    return Math.round(parseFloat(mlMatch[1]));
  }

  // Handle cl format (e.g., "75cl", "75 cl")
  const clMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*cl$/);
  if (clMatch && clMatch[1]) {
    return Math.round(parseFloat(clMatch[1]) * 10);
  }

  // Handle L format (e.g., "1.5L", "1.5 L", "1L")
  const lMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*l$/);
  if (lMatch && lMatch[1]) {
    return Math.round(parseFloat(lMatch[1]) * 1000);
  }

  return null;
};

/**
 * Format LWIN-18 from component parts
 *
 * LWIN-18 structure:
 * - Digits 1-7: Base LWIN (wine identifier)
 * - Digits 8-11: Vintage year (1000 for NV)
 * - Digits 12-13: Pack quantity (e.g., 12 for 12-pack)
 * - Digits 14-18: Bottle size in milliliters (e.g., 00750 for 750ml)
 *
 * This function always returns a full 18-digit LWIN when a base LWIN is provided.
 * Missing data uses standard defaults:
 * - Vintage: 1000 (NV - non-vintage indicator)
 * - Pack quantity: 06 (standard 6-pack)
 * - Bottle size: 00750 (750ml - standard wine bottle)
 *
 * @example
 *   formatLwin18({
 *     lwin: '1012361',
 *     vintage: '2009',
 *     bottleSize: '750ml',
 *     caseConfig: 12,
 *   });
 *   // returns '101236120091200750'
 *
 * @example
 *   formatLwin18({
 *     lwin: '1234567',
 *     vintage: '2018',
 *     caseConfig: 6,
 *   });
 *   // returns '123456720180600750' (uses default for bottle)
 *
 * @example
 *   formatLwin18({
 *     lwin: '1234567',
 *   });
 *   // returns '123456710000600750' (NV with defaults)
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

  // Ensure LWIN base is padded to 7 digits
  const baseLwin = lwin.padStart(7, '0').slice(0, 7);

  // Extract 4-digit year from vintage, default to 1000 (NV) if not available
  let vintageCode = '1000';
  if (vintage) {
    const yearMatch = vintage.match(/\b(19|20)\d{2}\b/);
    if (yearMatch && yearMatch[0]) {
      vintageCode = yearMatch[0];
    }
  }

  // Parse pack quantity, default to 6 (standard case)
  const packQty = parseCaseConfigToQty(caseConfig) ?? 6;
  const packCode = packQty.toString().padStart(2, '0').slice(0, 2);

  // Parse bottle size in ml, default to 750ml (standard wine bottle)
  const bottleMl = parseBottleSizeToMl(bottleSize) ?? 750;
  const bottleCode = bottleMl.toString().padStart(5, '0');

  return baseLwin + vintageCode + packCode + bottleCode;
};

/**
 * Format case configuration for human-readable display
 *
 * @example
 *   formatCaseConfig({ caseConfig: 6, bottleSize: '750ml' }); // returns '6x75cl'
 *   formatCaseConfig({ caseConfig: 12, bottleSize: '375ml' }); // returns '12x37.5cl'
 *   formatCaseConfig({ caseConfig: 1, bottleSize: '1.5L' }); // returns '1x150cl'
 *   formatCaseConfig({ caseConfig: '6x75cl' }); // returns '6x75cl' (passthrough)
 */
export const formatCaseConfig = ({
  caseConfig,
  bottleSize,
}: {
  caseConfig?: number | string | null;
  bottleSize?: string | null;
}): string | null => {
  // If caseConfig is already formatted (e.g., "6x75cl"), return as-is
  if (typeof caseConfig === 'string' && caseConfig.includes('x')) {
    return caseConfig;
  }

  const packQty = parseCaseConfigToQty(caseConfig);
  if (!packQty) return null;

  const bottleCl = parseBottleSizeToCl(bottleSize);
  if (!bottleCl) {
    // Just return the quantity if we don't have bottle size
    return `${packQty}x`;
  }

  // Format with decimal for non-whole centiliter values
  const clDisplay = bottleCl % 1 === 0 ? bottleCl.toString() : bottleCl.toFixed(1);

  return `${packQty}x${clDisplay}cl`;
};

export default formatLwin18;
