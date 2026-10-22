/**
 * The status a pending or expired quote takes once it is edited
 *
 * Validity decides it: a date still to come (or none) makes the quote live
 * again, which is how a misread or extended validity is put right; a date
 * already gone leaves it expired.
 *
 * @example
 *   quoteStatusAfterEdit(new Date('2026-11-15'), new Date('2026-10-22')); // 'pending'
 *
 * @param validUntil - The validity after the edit
 * @param now - Today
 * @returns 'pending' or 'expired'
 */
const quoteStatusAfterEdit = (validUntil: Date | null, now = new Date()) =>
  validUntil && validUntil.getTime() < now.getTime() ? ('expired' as const) : ('pending' as const);

export default quoteStatusAfterEdit;
