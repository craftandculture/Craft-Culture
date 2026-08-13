/**
 * A pack-agnostic LIKE pattern for a dashed LWIN18 — same wine, same vintage,
 * same bottle size, ANY pack (`1109704-2008-%-00750`). Returns null when the
 * code isn't in `WINE-VVVV-PP-SSSSS` shape.
 *
 * The pack a wine is ordered in and the pack it sits on the shelf in drift
 * constantly: a 3-pack is invoiced off a 6-pack, or a case is repacked into
 * 3-packs after the pick list was written. It's the same wine in the same bay,
 * so any lookup for "where is this wine" must ignore the pack segment. The
 * bottle size is deliberately kept — a magnum is a different physical thing.
 *
 * @example
 *   lwinPackAgnosticPattern('1109704-2008-06-00750'); // '1109704-2008-%-00750'
 *   lwinPackAgnosticPattern('GIN-LANG'); // null
 *
 * @param lwin18 - A dashed LWIN18 (or supplier code in the same shape)
 * @returns The LIKE pattern, or null when the code can't be split
 */
const lwinPackAgnosticPattern = (lwin18: string | null | undefined) => {
  if (!lwin18) return null;
  const parts = lwin18.split('-');
  if (parts.length !== 4) return null;
  const [wine, vintage, , size] = parts;
  return wine && vintage && size ? `${wine}-${vintage}-%-${size}` : null;
};

export default lwinPackAgnosticPattern;
