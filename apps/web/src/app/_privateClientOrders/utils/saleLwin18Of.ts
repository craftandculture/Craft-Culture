import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';

/**
 * The LWIN18 of the pack a line SELLS — its Zoho SKU
 *
 * A line holds the code of the case it comes out of; the pack segment is
 * replaced with the line's own case size. A client taking two bottles out of a
 * six is a different Zoho item from the six — booking it against the case code
 * bills two bottles at a case rate and depletes the wrong thing.
 *
 * Shared by the sales order and by the repair of item codes already raised, so
 * the code written into Zoho and the code corrected there are one definition.
 *
 * @example
 *   saleLwin18Of('1012781-2014-06-00750', 1); // '1012781-2014-01-00750'
 *
 * @param lwin - The line's LWIN18, dashed or compact
 * @param caseConfig - Bottles in the pack the line sells
 * @returns The sold pack's LWIN18, or the code unchanged if it is not LWIN18-shaped
 */
const saleLwin18Of = (lwin: string, caseConfig: number | null) => {
  const held = normalizeLwin18(lwin);
  const parts = held.split('-');
  const pack = caseConfig && caseConfig > 0 ? caseConfig : 12;

  if (parts.length !== 4) return held;

  return [parts[0], parts[1], String(pack).padStart(2, '0'), parts[3]].join('-');
};

export default saleLwin18Of;
