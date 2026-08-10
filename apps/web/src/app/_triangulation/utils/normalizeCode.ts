/**
 * Normalise a product code for cross-party matching
 *
 * The same SKU arrives written several ways across the five triangulation
 * inputs — "cd-1234", "CD 1234", "CD_1234" are all the same City Drinks code.
 * Normalising to uppercase alphanumerics lets a single lookup resolve them.
 *
 * @example
 *   normalizeCode('cd-1234 '); // returns 'CD1234'
 *
 * @param code - The raw code as it appeared in the source file
 * @returns The normalised code, or an empty string when there is nothing usable
 */
const normalizeCode = (code: string | null | undefined) => {
  if (!code) {
    return '';
  }

  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

export default normalizeCode;
