import { CLASSIFICATION } from './lwinNameFit';
import nameOverlap, { wordsOf } from './nameOverlap';

/**
 * Whether two LWIN register names are one wine
 *
 * The register lists some wines twice ("Marchesi Antinori, Tignanello, IGT"
 * and "Tignanello, Toscana"). Two names are one wine when every word of one
 * is in the other, and the longer adds only words such as the producer's name
 * or the region, never a classification: a premier cru is not its village
 * wine.
 *
 * @example
 *   isSameWine('Marchesi Antinori, Bolgheri, Guado Al Tasso', 'Guado Al Tasso, Bolgheri'); // true
 *   isSameWine('Domaine Fourrier, Gevrey-Chambertin Premier Cru', 'Domaine Fourrier, Gevrey-Chambertin'); // false
 *
 * @param a - One register name
 * @param b - The other
 * @returns True when they name the same wine
 */
const isSameWine = (a: string, b: string) => {
  const [shorter, longer] = wordsOf(a).length <= wordsOf(b).length ? [a, b] : [b, a];
  if (nameOverlap(longer, shorter) < 1) return false;
  const inShorter = new Set(wordsOf(shorter));
  return !wordsOf(longer).some((word) => !inShorter.has(word) && CLASSIFICATION.has(word));
};

export default isSameWine;
