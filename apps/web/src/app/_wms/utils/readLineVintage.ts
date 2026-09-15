import normalizeLwin18 from './normalizeLwin18';

/**
 * Read the vintage an order line states, and say so when it states none
 *
 * Three questions were being answered separately by every matcher that needed
 * them — what the code is, what year it is, and whether the product has a year
 * at all — and they disagreed on the third. A line whose SKU is a supplier code
 * rather than a LWIN, and whose name carries no year, yielded neither a vintage
 * nor the non-vintage flag, so the "vintage must agree" guard refused every
 * candidate and the line reported no stock however much of it was on the shelf.
 *
 * That is the whole of the spirits and canned-wine range: Compass Box, Brothers
 * Bond, NICE. SO-00133 showed 20 of 21 lines unmatched and every one of them
 * was a product with no vintage.
 *
 * **Non-vintage is anything that is not a four-digit year**, which covers the
 * two LWIN markers (`0000` and `1000`), a missing segment, and a supplier code
 * whose second segment is letters. `1000` must be caught before any numeric
 * comparison: `Number('1000')` is truthy, so it would otherwise be compared as
 * if the wine were vintage 1000.
 *
 * @example
 *   readLineVintage('1104695-2015-01-00750', 'Sandrone Barbera').vintage; // 2015
 *   readLineVintage('CB-ORCHARD-6X70', 'Compass Box').isNonVintage; // true
 *
 * @param sku - The line's SKU, LWIN-shaped or not
 * @param name - The line name, read for a year when the SKU carries none
 * @returns The code's segments, the vintage, and whether there is one at all
 */
const readLineVintage = (sku: string | null, name: string) => {
  const parts = normalizeLwin18(String(sku ?? '')).split('-');
  const lwin7 = parts[0] ?? '';
  const vintageStr = parts[1] ?? (name.match(/\b(19|20)\d{2}\b/)?.[0] ?? '');

  const isNonVintage =
    !/^\d{4}$/.test(vintageStr) ||
    vintageStr === '0000' ||
    vintageStr === '1000';

  return {
    parts,
    lwin7,
    vintageStr,
    isNonVintage,
    vintage: isNonVintage ? null : Number(vintageStr),
  };
};

export default readLineVintage;
