/**
 * Whether a value is actually an HS code
 *
 * The column had accumulated words — "Wine" among them — and any non-empty
 * string counted as filled, so a shipment read 165/165 in green while customs
 * would have rejected the line. A code that cannot be lodged is not a code.
 *
 * HS codes are digits: six for the international heading, eight or ten with
 * national subheadings. Nothing else qualifies, whatever it says.
 *
 * @example
 *   isValidHsCode('22042143'); // true
 *   isValidHsCode('Wine'); // false
 *
 * @param hsCode - The stored value
 * @returns Whether it is a usable HS code
 */
const isValidHsCode = (hsCode: string | null | undefined) => {
  const trimmed = (hsCode ?? '').replace(/[\s.]/g, '');

  return /^\d{6,10}$/.test(trimmed);
};

export default isValidHsCode;
