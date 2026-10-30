/**
 * Calms shouted words typed in capitals, leaving short codes as they are
 *
 * Supplier, forwarder and place names arrive from Hillebrand and forms as
 * "HILLEBRAND" or "Beaune, FRANCE". Words of four letters or more in capitals
 * read as names; UK, LCB, C&C and L.L.C stay.
 *
 * @example
 *   displayCase('Beaune, FRANCE'); // 'Beaune, France'
 *   displayCase('LCB Burton Gateway'); // unchanged
 */
const displayCase = <T extends string | null | undefined>(text: T): T =>
  (text ? text.replace(/\b[A-Z]{4,}\b/g, (word) => word[0] + word.slice(1).toLowerCase()) : text) as T;

export default displayCase;
