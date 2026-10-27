import normalizeLwin18Canonical from '@/app/_lwin/utils/normalizeLwin18';

/**
 * Normalize an LWIN-18 code to the standard dashed format
 *
 * Kept for the existing WMS imports; the single implementation lives in
 * `@/app/_lwin/utils/normalizeLwin18`. This wrapper keeps the string-in,
 * string-out signature the WMS callers rely on.
 *
 * @example
 *   normalizeLwin18('110203720101200750'); // '1102037-2010-12-00750'
 *
 * @param lwin18 - The LWIN-18 code to normalize
 * @returns The normalized LWIN-18 with dashes
 */
const normalizeLwin18 = (lwin18: string): string =>
  normalizeLwin18Canonical(lwin18) ?? lwin18;

export default normalizeLwin18;
