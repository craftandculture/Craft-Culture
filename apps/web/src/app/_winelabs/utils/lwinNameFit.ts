import nameOverlap, { wordsOf } from './nameOverlap';

/** Classification words: when our name has one the register name lacks, that name is another wine */
const CLASSIFICATION = new Set(['premier', '1er', 'grand', 'cru', 'village', 'villages']);

/**
 * How well a register name fits our product name, from 0 to 1
 *
 * Its overlap, less a quarter for each classification word (Premier Cru,
 * Grand Cru) ours carries and it lacks, so a village code is not read as our
 * premier cru.
 *
 * @example
 *   lwinNameFit('Antinori, Solaia, IGT 2016', 'Antinori, Solaia'); // 1
 *   lwinNameFit('Denis Mortet Premier Cru Gevrey-Chambertin', 'Denis Mortet, Gevrey-Chambertin'); // 0.5
 *
 * @param ourName - Our product name, or a supplier's line
 * @param registerName - The register's name for a code, or null when there is none
 * @returns The fit, 0 when there is no name to read
 */
const lwinNameFit = (ourName: string, registerName: string | null) => {
  if (!registerName) return 0;
  const theirs = new Set(wordsOf(registerName));
  const missing = [...new Set(wordsOf(ourName))].filter((word) => CLASSIFICATION.has(word) && !theirs.has(word));
  return nameOverlap(ourName, registerName) - missing.length * 0.25;
};

export { CLASSIFICATION };

export default lwinNameFit;
