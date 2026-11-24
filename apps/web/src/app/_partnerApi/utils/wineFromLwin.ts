/**
 * The wine fields the partner API publishes, read from a dashed LWIN18
 *
 * The code is the one thing every record carries the same way: names are
 * whatever the receiving clerk typed, so vintage, pack and bottle size come
 * from the code, and the name rides alongside as given.
 *
 * @example
 *   wineFromLwin('1010279-2015-06-00750', 'Château X');
 *   // { lwin18: '1010279-2015-06-00750', lwin11: '10102792015', name: 'Château X',
 *   //   vintage: 2015, caseSize: 6, bottleSizeMl: 750 }
 *
 * @param lwin18 - Dashed LWIN18
 * @param name - The wine's name as recorded
 * @returns The published wine object
 */
const wineFromLwin = (lwin18: string, name: string) => {
  const [lwin7, year, pack, size] = lwin18.split('-');
  const vintage = Number(year);
  const caseSize = Number(pack);
  const ml = Number(size);

  return {
    lwin18,
    lwin11: lwin7 && year ? `${lwin7}${year}` : null,
    name,
    vintage: /^(19|20)\d{2}$/.test(year ?? '') ? vintage : null,
    caseSize: Number.isFinite(caseSize) && caseSize > 0 ? caseSize : null,
    bottleSizeMl: Number.isFinite(ml) && ml > 0 ? ml : null,
  };
};

export default wineFromLwin;
