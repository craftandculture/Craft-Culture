/** LWIN7, vintage, pack, millilitres */
const DASHED_18 = /^\d{7}-\d{4}-\d{2}-\d{5}$/;

/**
 * Accept a value only if it is actually a LWIN
 *
 * The extractor is told the code lives in a "Product Code" column, and on an
 * invoice that has no such column it takes whatever is nearest — an account
 * number, an order reference — and writes it to every line. A shipment then
 * arrives with Margaux 1993, Opus One 2014 and Sassicaia 1989 all mapped to
 * 121084 and all showing as matched, which is worse than showing as unmapped:
 * a green tick is read as work already done.
 *
 * Only a complete eighteen-digit LWIN counts. A bare seven-digit stem names the
 * wine but not the bottling, and it cannot be received against or picked — and
 * a green tick beside it is read as work already done, so half an answer is
 * worse here than none.
 *
 * @example
 *   toValidLwin('100604520190600750'); // '1006045-2019-06-00750'
 *   toValidLwin('121084'); // null
 *   toValidLwin('1006045'); // null — names the wine, not the bottling
 *
 * @param value - Whatever the document gave
 * @returns A normalised LWIN, or null when it is not one
 */
const toValidLwin = (value: string | null | undefined) => {
  const trimmed = (value ?? '').trim();

  if (!trimmed) return null;

  const compact = trimmed.replace(/\s/g, '');

  // Dashes are how this codebase stores a LWIN, so a dashless copy is the same
  // code needing its dashes back rather than a different one.
  const normalised = /^\d{18}$/.test(compact)
    ? `${compact.slice(0, 7)}-${compact.slice(7, 11)}-${compact.slice(11, 13)}-${compact.slice(13)}`
    : compact;

  return DASHED_18.test(normalised) ? normalised : null;
};

export default toValidLwin;
