/**
 * Normalize an LWIN-18 code to the standard dashed format
 *
 * Handles two input formats:
 * - Already dashed: `1102037-2010-12-00750` → returned as-is
 * - Compact (no dashes): `110203720101200750` → `1102037-2010-12-00750`
 *
 * Non-numeric LWINs (e.g. `GINLANG700-0000-06-00700`) are returned unchanged.
 *
 * @example
 *   normalizeLwin18('110203720101200750'); // '1102037-2010-12-00750'
 *   normalizeLwin18('1102037-2010-12-00750'); // '1102037-2010-12-00750'
 *
 * @param lwin18 - The LWIN-18 code to normalize
 * @returns The normalized LWIN-18 with dashes
 */
const normalizeLwin18 = (lwin18: string) => {
  // Already has dashes or is not a pure 18-digit numeric string — return as-is
  if (lwin18.includes('-') || lwin18.length !== 18 || !/^\d{18}$/.test(lwin18)) {
    return lwin18;
  }

  // Convert compact 18-digit format to dashed: LLLLLLL-YYYY-CC-SSSSS
  return `${lwin18.slice(0, 7)}-${lwin18.slice(7, 11)}-${lwin18.slice(11, 13)}-${lwin18.slice(13)}`;
};

export default normalizeLwin18;
