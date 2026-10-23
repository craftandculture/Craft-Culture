import normalizeLwin18 from '@/app/_lwin/utils/normalizeLwin18';

/**
 * The wine-and-vintage part of an LWIN18, which is what Wine Labs prices
 *
 * Pack and bottle size are dropped: a 6-pack and a 12-pack of one vintage
 * are one wine to Wine Labs, and to the cache.
 *
 * @example
 *   lwin11Of('1012781-2015-06-00750'); // { lwin7: '1012781', vintage: '2015', lwin11: '10127812015' }
 *   lwin11Of('101278120150600750'); // same
 *   lwin11Of('GIN-0001'); // null
 *
 * @param lwin18 - An LWIN18, dashed or compact
 * @returns The LWIN7, vintage and LWIN11, or null when it is not an LWIN18
 */
const lwin11Of = (lwin18: string | null | undefined) => {
  const match = normalizeLwin18(lwin18)?.match(/^(\d{7})-(\d{4})-\d{2}-\d{5}$/);
  if (!match?.[1] || !match[2]) return null;
  return { lwin7: match[1], vintage: match[2], lwin11: `${match[1]}${match[2]}` };
};

export default lwin11Of;
