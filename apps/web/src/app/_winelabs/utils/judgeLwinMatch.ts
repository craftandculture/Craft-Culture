import isSameWine from './isSameWine';
import lwinNameFit from './lwinNameFit';

/** Share of the register's name our name must carry to be the same wine */
const SAME_WINE = 0.75;

/**
 * Which LWIN is more likely right, ours or the one Wine Labs' name search found
 *
 * Both codes are looked up in the LWIN register. When the two register names
 * are one wine (the register lists some wines twice, such as "Marchesi
 * Antinori, Tignanello" and "Tignanello, Toscana"), there is nothing to fix.
 * Otherwise our product name is read against both: the one it reads as is
 * probably right, and ours wins any tie, since a search that missed on a
 * correct code is common.
 *
 * @example
 *   judgeLwinMatch(
 *     'Antinori Solaia 2016',
 *     'Antinori, Solaia',
 *     'Antinori, Tignanello',
 *   ); // 'ours_right'
 *   judgeLwinMatch(
 *     'Denis Mortet Premier Cru Gevrey',
 *     'Denis Mortet, Gevrey-Chambertin, Villages',
 *     'Denis Mortet, Gevrey-Chambertin Premier Cru',
 *   ); // 'likely_wrong'
 *
 * @param ourName - Our product name
 * @param ourRegisterName - The register's name for the LWIN we hold, or null
 *   when it is not in the register
 * @param suggestedRegisterName - The register's name for Wine Labs' LWIN, or
 *   null
 * @returns Same_wine | ours_right | likely_wrong | check
 */
const judgeLwinMatch = (
  ourName: string,
  ourRegisterName: string | null,
  suggestedRegisterName: string | null,
) => {
  if (
    ourRegisterName &&
    suggestedRegisterName &&
    isSameWine(ourRegisterName, suggestedRegisterName)
  ) {
    return 'same_wine' as const;
  }

  const ours = lwinNameFit(ourName, ourRegisterName);
  const suggested = lwinNameFit(ourName, suggestedRegisterName);

  if (ours >= SAME_WINE && ours >= suggested) return 'ours_right' as const;
  if (suggested >= SAME_WINE && suggested > ours)
    return 'likely_wrong' as const;
  return 'check' as const;
};

export type LwinVerdict = ReturnType<typeof judgeLwinMatch>;

export default judgeLwinMatch;
