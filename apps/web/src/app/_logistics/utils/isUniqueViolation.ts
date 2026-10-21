/**
 * Whether a database error is a duplicate key (Postgres 23505)
 *
 * Numbers such as QRQ- and QTE- are the next after the highest on file, so two
 * saves in the same moment can pick the same one; the unique index refuses the
 * second, and the caller tries again with a fresh number.
 *
 * @example
 *   if (isUniqueViolation(error) && attempt < 2) continue;
 *
 * @param error - Whatever was thrown
 * @returns True when the insert clashed with a unique index
 */
const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && (error as { code: unknown }).code === '23505') return true;

  return 'cause' in error && isUniqueViolation((error as { cause: unknown }).cause);
};

export default isUniqueViolation;
