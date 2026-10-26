/** How long a wine counts as recently added to The Cellar List */
const RECENT_DAYS = 7;

/**
 * Whether a wine reached the warehouse within the last week
 *
 * @example
 *   isRecentlyAdded('2026-10-25 09:00:00'); // true on 26 October
 *
 * @param addedAt - When the wine first arrived, as the catalogue returns it
 * @returns True for a wine new to the list this week
 */
const isRecentlyAdded = (addedAt: string | null | undefined) => {
  if (!addedAt) return false;

  const arrived = new Date(addedAt.replace(' ', 'T')).getTime();

  return Number.isFinite(arrived) && Date.now() - arrived < RECENT_DAYS * 86_400_000;
};

export default isRecentlyAdded;
