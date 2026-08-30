/**
 * The pack-agnostic key of an LWIN18, computed in JavaScript
 *
 * The SQL twin of this lives in `lwinPakKey`, which every read joins pricing
 * on. This is the value to compare that expression against, so a write can
 * reach the same row a read will find.
 *
 * @example
 *   pakKeyOf('1104653-2020-06-00750'); // '1104653-2020-00750'
 *
 * @param lwin18 - A dashed LWIN18
 * @returns wine-vintage-size, with the pack segment dropped
 */
const pakKeyOf = (lwin18: string) => {
  const parts = lwin18.split('-');

  return `${parts[0] ?? ''}-${parts[1] ?? ''}-${parts[3] ?? ''}`;
};

export default pakKeyOf;
