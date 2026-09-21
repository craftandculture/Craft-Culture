import normalizeLwin18 from './normalizeLwin18';
import pakKeyOf from './pakKeyOf';

/**
 * Pull the LWIN18 out of a scanned case barcode
 *
 * Case labels are `CASE-{lwin18}-{seq}` (see `generateCaseLabelBarcode`), but
 * pickers also scan a bare LWIN18 off a stock label, and Cult Wines codes
 * arrive compact. The trailing sequence is three digits and an LWIN18 ends in
 * a five-digit bottle size, so stripping `-NNN` cannot eat a real segment.
 *
 * Non-numeric LWINs (`SOTCAS750B-0000-06-00700`) survive this untouched, which
 * is why it works on the dashes rather than on digits.
 *
 * @example
 *   extractScannedLwin18('CASE-1010279-2015-06-00750-001'); // '1010279-2015-06-00750'
 *
 * @param barcode - Whatever the scanner read
 * @returns The LWIN18 it carries, normalized to dashed form
 */
export const extractScannedLwin18 = (barcode: string) => {
  let code = barcode.trim().toUpperCase();

  if (code.startsWith('CASE-')) code = code.slice('CASE-'.length);

  return normalizeLwin18(code.replace(/-\d{3}$/, ''));
};

/**
 * Does this scanned case hold the wine the pick line asks for?
 *
 * Compared pack-agnostically — wine, vintage and bottle size must agree, the
 * pack segment need not. A case that has been cracked keeps the label it was
 * printed with: take two bottles off a 3-pack and the shelf holds a `…-01-…`
 * stock row inside a box still marked `…-03-…`. Matching the full code there
 * is guaranteed to fail, and the only way past it was "Skip Scan — Confirm
 * Manually", which verifies nothing at all. A stale pack digit is the one part
 * of that label we already know not to trust.
 *
 * Bottle size is deliberately still compared: a magnum is a different physical
 * thing and scanning one must never satisfy a 75cl line.
 *
 * @example
 *   // cracked 3-pack, line is now singles
 *   caseScanMatchesLwin('CASE-1010279-2015-03-00750-001', '1010279-2015-01-00750'); // true
 *   // right wine, wrong size
 *   caseScanMatchesLwin('CASE-1010279-2015-03-01500-001', '1010279-2015-01-00750'); // false
 *
 * @param barcode - Whatever the scanner read
 * @param lwin18 - The LWIN18 on the pick line
 * @returns Whether the scan should be accepted
 */
const caseScanMatchesLwin = (barcode: string, lwin18: string) => {
  const scanned = extractScannedLwin18(barcode);
  const expected = normalizeLwin18(lwin18.trim().toUpperCase());

  if (!scanned || !expected) return false;

  const scannedKey = pakKeyOf(scanned);
  const expectedKey = pakKeyOf(expected);

  // A key needs all three parts; a partial scan must not match on blanks.
  if (scannedKey.split('-').some((part) => part === '')) return false;

  return scannedKey === expectedKey;
};

export default caseScanMatchesLwin;
