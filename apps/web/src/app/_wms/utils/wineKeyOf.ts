/**
 * The part of a stock code that names the wine, shared by every vintage, pack
 * and size of it: the LWIN7 of an LWIN18, or the leading code of a wine
 * without one (a supplier code, or the name code Add to stock gives)
 *
 * Colour is held against this, so it is set once per wine.
 *
 * @example
 *   wineKeyOf('1009613-2022-06-00750'); // '1009613'
 *   wineKeyOf('N37580124-2022-03-00750'); // 'N37580124'
 */
const wineKeyOf = (lwin18: string) => {
  const code = lwin18.trim();
  // A compact 18-digit LWIN, as Cult Wines and Liv-ex send it
  if (/^\d{18}$/.test(code)) return code.slice(0, 7);
  return code.split('-')[0] ?? '';
};

export default wineKeyOf;
