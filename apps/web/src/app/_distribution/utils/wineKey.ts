/**
 * One wine, as everything here must agree to key it
 *
 * The TypeScript twin of `packAgnostic` in `codeBridge`, and it exists so the
 * two can never drift: the balances match a distributor's line to our wine
 * pack-agnostically, and a suggestion list matching on the full LWIN would
 * report a wine as unreached that the table had already reconciled. Two
 * answers to one question is how this project lost a day.
 *
 * Squashed to letters and digits, then the pack dropped from an 18-digit LWIN.
 * The bottle size stays: a magnum is a different wine to anyone who drinks
 * one, and to the distributor counting them.
 *
 * @example
 *   wineKey('1104653-2020-01-00750'); // '110465320200 0750' without spaces
 *   wineKey('1104653-2020-06-00750'); // the same key, being the same wine
 *
 * @param value - A LWIN, a code, or a product name
 * @returns The key both sides join on
 */
const wineKey = (value: string | null | undefined) => {
  const squashed = (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!/^[0-9]{18}$/.test(squashed)) return squashed;

  return squashed.slice(0, 11) + squashed.slice(13);
};

export default wineKey;
