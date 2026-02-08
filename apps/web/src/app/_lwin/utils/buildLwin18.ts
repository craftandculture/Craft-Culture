/**
 * Build LWIN18 from components
 *
 * LWIN18 format: LLLLLLL-YYYY-CC-BBBBB
 * - LLLLLLL: 7-digit LWIN (wine identifier)
 * - YYYY: 4-digit vintage year (0000 for NV)
 * - CC: 2-digit case configuration (01, 03, 06, 12, etc.)
 * - BBBBB: 5-digit bottle size in ml (00750, 01500, 03000, etc.)
 *
 * @example
 *   buildLwin18({ lwin7: '1013573', vintage: 2020, caseSize: 6, bottleSizeMl: 750 });
 *   // Returns: { lwin18: '1013573-2020-06-00750', compact: '101357320200600750' }
 */

export interface Lwin18Components {
  lwin7: string;
  vintage: number | null; // null for NV (non-vintage)
  caseSize: number;
  bottleSizeMl: number;
}

export interface Lwin18Result {
  lwin18: string; // With dashes: 1013573-2020-06-00750
  compact: string; // Without dashes: 101357320200600750 (Zoho SKU format)
  components: {
    lwin7: string;
    vintage: string;
    caseSize: string;
    bottleSize: string;
  };
}

/**
 * Common bottle sizes in ml
 */
export const BOTTLE_SIZES = [
  { ml: 375, label: '375ml (Half)' },
  { ml: 500, label: '500ml' },
  { ml: 750, label: '750ml (Standard)' },
  { ml: 1500, label: '1.5L (Magnum)' },
  { ml: 3000, label: '3L (Double Magnum)' },
  { ml: 6000, label: '6L (Imperial)' },
] as const;

/**
 * Common case configurations
 */
export const CASE_SIZES = [
  { size: 1, label: '1 bottle' },
  { size: 2, label: '2 bottles' },
  { size: 3, label: '3 bottles' },
  { size: 6, label: '6 bottles' },
  { size: 12, label: '12 bottles' },
  { size: 24, label: '24 bottles' },
] as const;

const buildLwin18 = (components: Lwin18Components): Lwin18Result => {
  const { lwin7, vintage, caseSize, bottleSizeMl } = components;

  // Validate LWIN7 (should be 7 digits)
  if (!/^\d{7}$/.test(lwin7)) {
    throw new Error(`Invalid LWIN7: ${lwin7}. Must be 7 digits.`);
  }

  // Format vintage (4 digits, 0000 for NV)
  const vintageStr = vintage ? String(vintage).padStart(4, '0') : '0000';
  if (vintageStr.length !== 4) {
    throw new Error(`Invalid vintage: ${vintage}. Must be 4 digits or null for NV.`);
  }

  // Format case size (2 digits)
  const caseSizeStr = String(caseSize).padStart(2, '0');
  if (caseSize < 1 || caseSize > 99) {
    throw new Error(`Invalid case size: ${caseSize}. Must be 1-99.`);
  }

  // Format bottle size (5 digits)
  const bottleSizeStr = String(bottleSizeMl).padStart(5, '0');
  if (bottleSizeMl < 1 || bottleSizeMl > 99999) {
    throw new Error(`Invalid bottle size: ${bottleSizeMl}. Must be 1-99999 ml.`);
  }

  const lwin18 = `${lwin7}-${vintageStr}-${caseSizeStr}-${bottleSizeStr}`;
  const compact = `${lwin7}${vintageStr}${caseSizeStr}${bottleSizeStr}`;

  return {
    lwin18,
    compact,
    components: {
      lwin7,
      vintage: vintageStr,
      caseSize: caseSizeStr,
      bottleSize: bottleSizeStr,
    },
  };
};

/**
 * Parse LWIN18 back into components
 */
export const parseLwin18 = (lwin18: string): Lwin18Components | null => {
  // Try dashed format first: 1013573-2020-06-00750
  const dashedMatch = lwin18.match(/^(\d{7})-(\d{4})-(\d{2})-(\d{5})$/);
  if (dashedMatch) {
    const [, lwin7, vintage, caseSize, bottleSize] = dashedMatch;
    return {
      lwin7,
      vintage: vintage === '0000' ? null : parseInt(vintage, 10),
      caseSize: parseInt(caseSize, 10),
      bottleSizeMl: parseInt(bottleSize, 10),
    };
  }

  // Try compact format: 101357320200600750
  const compactMatch = lwin18.match(/^(\d{7})(\d{4})(\d{2})(\d{5})$/);
  if (compactMatch) {
    const [, lwin7, vintage, caseSize, bottleSize] = compactMatch;
    return {
      lwin7,
      vintage: vintage === '0000' ? null : parseInt(vintage, 10),
      caseSize: parseInt(caseSize, 10),
      bottleSizeMl: parseInt(bottleSize, 10),
    };
  }

  return null;
};

export default buildLwin18;
