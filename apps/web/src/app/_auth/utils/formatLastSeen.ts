import { differenceInCalendarDays, format } from 'date-fns';

/**
 * Say when a user last signed in, the way a person would
 *
 * "Today", "Yesterday", "5 days ago" for the recent past, then the date. The
 * exact date and time is returned separately for a tooltip. `stale` marks a
 * login older than 60 days, which on an admin list is the thing worth seeing.
 *
 * @example
 *   formatLastSeen(new Date()); // { label: 'Today', title: '27 Oct 2026, 09:14', stale: false }
 *   formatLastSeen(null); // { label: 'Never', title: 'Has never signed in', stale: true }
 *
 * @param value - The last sign-in time, or null when there has been none
 * @param now - The reference time (defaults to now)
 * @returns The label, its tooltip and whether it is stale
 */
const formatLastSeen = (value: Date | string | null | undefined, now = new Date()) => {
  if (!value) {
    return { label: 'Never', title: 'Has never signed in', stale: true };
  }

  const date = new Date(value);
  const days = differenceInCalendarDays(now, date);
  const title = format(date, 'd MMM yyyy, HH:mm');

  if (days <= 0) return { label: 'Today', title, stale: false };
  if (days === 1) return { label: 'Yesterday', title, stale: false };
  if (days < 14) return { label: `${days} days ago`, title, stale: false };

  return {
    label: format(date, days > 300 ? 'd MMM yyyy' : 'd MMM'),
    title,
    stale: days > 60,
  };
};

export default formatLastSeen;
