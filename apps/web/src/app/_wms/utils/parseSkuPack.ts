/**
 * Largest pack size we accept from a SKU. Real cases top out at 24 bottles, so
 * anything above this is corrupt SKU data rather than a giant case — e.g. the
 * Zoho items carrying `106313220206600750` (pack digits `66`) and
 * `124356120206200750` (pack digits `62`) for wines that are physically 6x75cl.
 */
const MAX_PLAUSIBLE_PACK = 24;

/**
 * Parse the pack config out of an LWIN18-style SKU
 *
 * An LWIN18 is `LWIN7(7) + vintage(4) + pack(2) + bottle size in ml(5)`, dashed
 * or compact. The SKU is the source of truth for the pack — a drifted line
 * description must not be able to misstate the bottle count — but only when the
 * parsed pack is physically plausible. A corrupt SKU whose pack digits read
 * `66` would otherwise turn 4 cases into 264 bottles, so it is rejected here and
 * the caller falls back to the line description ("6x75cl").
 *
 * @example
 *   parseSkuPack('1014525-2019-06-00750'); // { pack: 6, bottleSize: '75cl' }
 *   parseSkuPack('106313220206600750'); // null — pack digits '66' are corrupt
 *   parseSkuPack('GINLANG700-0000-06-00700'); // null — not an LWIN18
 *
 * @param sku - The line item SKU
 * @returns The pack size and bottle size, or null when the SKU is not a usable
 *   LWIN18
 */
const parseSkuPack = (sku: string | null | undefined) => {
  const digits = String(sku ?? '').replace(/-/g, '');
  if (!/^\d{18}$/.test(digits)) return null;

  const pack = Number(digits.slice(11, 13));
  if (pack < 1 || pack > MAX_PLAUSIBLE_PACK) return null;

  const ml = Number(digits.slice(13, 18));
  return { pack, bottleSize: ml > 0 ? `${ml / 10}cl` : null };
};

export default parseSkuPack;
