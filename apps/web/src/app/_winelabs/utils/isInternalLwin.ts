/**
 * Whether an LWIN7 is one of our own codes (9000001 and up)
 *
 * They are LWIN-shaped so they work everywhere an LWIN does, but no exchange
 * lists them: asking Wine Labs for their market only spends credits.
 *
 * @example
 *   isInternalLwin('9000012'); // true
 *   isInternalLwin('1012781'); // false
 *
 * @param lwin7 - The wine's LWIN7
 * @returns True for our internal codes
 */
const isInternalLwin = (lwin7: string) => lwin7.startsWith('9');

export default isInternalLwin;
