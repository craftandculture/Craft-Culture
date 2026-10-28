import nameOverlap from './nameOverlap';

/** Share of the register's name our name must carry to be the same wine */
const SAME_WINE = 0.75;

/**
 * Which LWIN is more likely right, ours or the one Wine Labs' name search found
 *
 * Both codes are looked up in the LWIN register, so the question becomes whose
 * register name our product name actually reads as. A search that missed on a
 * correct code is common, so ours wins any tie.
 *
 * @example
 *   judgeLwinMatch(
 *     'Antinori Solaia 2016',
 *     'Antinori, Solaia',
 *     'Antinori, Tignanello',
 *   ); // 'ours_right'
 *   judgeLwinMatch(
 *     'Fourrier Griotte-Chambertin',
 *     'Domaine Fourrier, Gevrey-Chambertin',
 *     'Domaine Fourrier, Griotte-Chambertin',
 *   ); // 'likely_wrong'
 *
 * @param ourName - Our product name
 * @param ourRegisterName - The register's name for the LWIN we hold, or null
 *   when it is not in the register
 * @param suggestedRegisterName - The register's name for Wine Labs' LWIN, or
 *   null
 * @returns Ours_right | likely_wrong | check
 */
const judgeLwinMatch = (
  ourName: string,
  ourRegisterName: string | null,
  suggestedRegisterName: string | null,
) => {
  const ours = ourRegisterName ? nameOverlap(ourName, ourRegisterName) : 0;
  const suggested = suggestedRegisterName
    ? nameOverlap(ourName, suggestedRegisterName)
    : 0;

  if (ours >= SAME_WINE && ours >= suggested) return 'ours_right' as const;
  if (suggested >= SAME_WINE && suggested > ours)
    return 'likely_wrong' as const;
  return 'check' as const;
};

export type LwinVerdict = ReturnType<typeof judgeLwinMatch>;

export default judgeLwinMatch;
