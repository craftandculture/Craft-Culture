import normalizeLwin18 from '@/app/_lwin/utils/normalizeLwin18';

/**
 * The wine-and-vintage part of an LWIN18, which is what Wine Labs prices
 *
 * The pack is dropped: a 6-pack and a 12-pack of one vintage are one wine to
 * Wine Labs, and to the cache. The bottle size is returned apart, in ml as
 * the exchanges write it ('750', '1500'), for the prices that depend on it.
 *
 * @example
 *   lwin11Of('1012781-2015-06-00750'); // { lwin7: '1012781', vintage: '2015', lwin11: '10127812015', format: '750' }
 *   lwin11Of('101278120150600750'); // same
 *   lwin11Of('2360072-0000-06-00750'); // vintage '1000', LWIN's non-vintage
 *   lwin11Of('GIN-0001'); // null
 *
 * @param lwin18 - An LWIN18, dashed or compact
 * @returns The LWIN7, vintage, LWIN11 and bottle size, or null when it is not an LWIN18
 */
const lwin11Of = (lwin18: string | null | undefined) => {
  const match = normalizeLwin18(lwin18)?.match(/^(\d{7})-(\d{4})-\d{2}-(\d{5})$/);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  // Some stock carries 0000 for non-vintage; LWIN's own placeholder is 1000
  const vintage = match[2] === '0000' ? '1000' : match[2];
  return { lwin7: match[1], vintage, lwin11: `${match[1]}${vintage}`, format: String(Number(match[3])) };
};

export default lwin11Of;
