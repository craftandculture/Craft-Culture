import { format } from 'date-fns';

const WINDOWS: Record<string, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
};

/**
 * A member's preferred delivery day, as a person would say it
 *
 * @example
 *   describePreferredDelivery('2026-10-21', 'morning'); // 'Tue 21 Oct, morning'
 *   describePreferredDelivery(null, 'afternoon'); // 'Any day, afternoon'
 *
 * @param preferredDate - YYYY-MM-DD, or nothing
 * @param preferredWindow - morning | afternoon | any, or nothing
 * @returns The description, or null when no preference was given
 */
const describePreferredDelivery = (
  preferredDate: string | null | undefined,
  preferredWindow: string | null | undefined,
) => {
  const window = preferredWindow ? WINDOWS[preferredWindow] : undefined;

  if (!preferredDate && !window) return null;

  /* Noon, so a date never slips a day either side of UTC */
  const day = preferredDate
    ? format(new Date(`${preferredDate}T12:00:00`), 'EEE d MMM')
    : 'Any day';

  return window ? `${day}, ${window}` : day;
};

export default describePreferredDelivery;
