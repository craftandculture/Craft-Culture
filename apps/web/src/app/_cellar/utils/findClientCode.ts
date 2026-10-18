/**
 * The member reference written somewhere in a free-text field
 *
 * Merchants type it however they like into the order reference — "PC-1001",
 * "pc 1001", "PC1001/2" or "Smith PC-1001" — so it is found anywhere in the
 * text and returned in the one form it is issued in.
 *
 * @example
 *   findClientCode('Smith pc 1001/2'); // 'PC-1001'
 *
 * @param value - The text to search, such as an LCB order reference
 * @returns The reference as issued, or null when there is none
 */
const findClientCode = (value: string | null | undefined) => {
  const match = /(?:^|[^A-Z0-9])PC[\s-]?(\d{4,6})(?!\d)/i.exec(value ?? '');

  return match ? `PC-${match[1]}` : null;
};

export default findClientCode;
