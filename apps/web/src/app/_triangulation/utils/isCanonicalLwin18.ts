/** LWIN7, vintage, pack and millilitres, dashed */
const CANONICAL = /^\d{7}-\d{4}-\d{2}-\d{5}$/;

/**
 * Whether a code is a real dashed LWIN-18 and fit to be a rename target
 *
 * The warehouse holds codes that occupy the LWIN column without being LWINs —
 * `rentW4301023-0000-06-00750` is a supplier reference that was written there,
 * and there are others. They are harmless while they sit in the WMS and
 * actively wrong the moment they are adopted as the standard: renaming a Zoho
 * item to one would spread a bad code into the accounts rather than out of
 * them.
 *
 * @example
 *   isCanonicalLwin18('1102037-2010-12-00750'); // true
 *   isCanonicalLwin18('rentW4301023-0000-06-00750'); // false
 *
 * @param lwin18 - The code to test
 * @returns Whether it is a genuine dashed LWIN-18
 */
const isCanonicalLwin18 = (lwin18: string | null | undefined) =>
  !!lwin18 && CANONICAL.test(lwin18.trim());

export default isCanonicalLwin18;
