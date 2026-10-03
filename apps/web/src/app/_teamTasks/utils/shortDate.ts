/**
 * A due date as people say it: "Mon 6 Oct"
 *
 * @example
 *   shortDate('2026-10-06'); // 'Mon 6 Oct'
 *
 * @param iso - A `YYYY-MM-DD` date
 * @returns The weekday, day and month
 */
const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

export default shortDate;
