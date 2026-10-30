import { wordsOf } from '@/app/_winelabs/utils/nameOverlap';

import { WINELABS_FIT } from '../constants/lwinMatching';

/**
 * Which LWIN7 an inbound line should be given without asking a person
 *
 * Wine Labs first, when its answer reads as the line and names the line's
 * producer; then our register, but only when Wine Labs had nothing to say.
 * When the two name different wines, a person decides. In the October 2026
 * test on confirmed lines, the register's guess where Wine Labs was unsure was
 * wrong both times (Pontet-Canet, Lynch-Bages), and Wine Labs' slips were all
 * another producer's wine (Boekenhoutskloof for Rickety Bridge).
 *
 * @example
 *   decideLwinMatch('Rickety Bridge Noble Late Harvest', { lwin7: '1597459', fit: 0.83, producer: 'Boekenhoutskloof' }, '2034425');
 *   // null: the line does not name Boekenhoutskloof, and the register disagrees
 *
 * @param line - The supplier's line, with the producer when the invoice gave one
 * @param winelabs - Wine Labs' answer, its fit and the producer on record, or null when it found nothing
 * @param registerLwin7 - The register's clear winner, or null when it had none
 * @returns The LWIN7 to write and who chose it, or null to leave the line for a person
 */
const decideLwinMatch = (
  line: string,
  winelabs: { lwin7: string; fit: number; producer: string | null } | null,
  registerLwin7: string | null,
) => {
  if (winelabs) {
    const lineWords = new Set(wordsOf(line));
    const producerNamed =
      !winelabs.producer || wordsOf(winelabs.producer).every((word) => lineWords.has(word));
    if (winelabs.fit >= WINELABS_FIT && producerNamed) {
      return { lwin7: winelabs.lwin7, source: 'winelabs' as const };
    }
    if (registerLwin7 === winelabs.lwin7) return { lwin7: registerLwin7, source: 'winelabs' as const };
    // Wine Labs answered and the register names another wine: not a guess to file
    return null;
  }
  return registerLwin7 ? { lwin7: registerLwin7, source: 'register' as const } : null;
};

export default decideLwinMatch;
