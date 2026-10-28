/**
 * How Wine Labs' name match compares with the LWIN we hold
 *
 * C&C internal codes start with 9 (see _lwin/controller/adminNextInternalLwin),
 * so any match on one is a real LWIN we could move the wine to.
 *
 * @example
 *   classifyMatch('1012781', '1012781'); // 'agrees'
 *   classifyMatch('9000012', '1012781'); // 'internal_known'
 *
 * @param ourLwin7 - The LWIN7 on our stock
 * @param matchedLwin7 - The LWIN7 Wine Labs returned, or null for no match
 * @returns agrees | different | not_found | internal_known
 */
const classifyMatch = (ourLwin7: string, matchedLwin7: string | null) => {
  if (!matchedLwin7) return 'not_found' as const;
  if (matchedLwin7 === ourLwin7) return 'agrees' as const;
  if (ourLwin7.startsWith('9')) return 'internal_known' as const;
  return 'different' as const;
};

export type MatchStatus = ReturnType<typeof classifyMatch>;

export default classifyMatch;
