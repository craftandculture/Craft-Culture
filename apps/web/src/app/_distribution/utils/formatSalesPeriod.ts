/**
 * Name the period a daily sales window covers
 *
 * One day when the window is the normal 24 hours. When a pull was missed the
 * window stretches over several days, and naming only the first of them reads
 * as though six days of sales happened on a Sunday — so it becomes a range.
 *
 * @example
 *   formatSalesPeriod('2026-09-27', 24); // 'Sunday 27 September'
 *   formatSalesPeriod('2026-09-27', 144); // 'Sun 27 Sep – Fri 2 Oct'
 *
 * @param salesDate - The Dubai date the window opened on, YYYY-MM-DD
 * @param spanHours - How long the window ran
 * @returns The period in words
 */
const formatSalesPeriod = (salesDate: string, spanHours: number) => {
  const start = new Date(`${salesDate}T12:00:00Z`);
  const days = Math.max(1, Math.round(spanHours / 24));

  if (days === 1) {
    return start.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  }

  const end = new Date(start.getTime() + (days - 1) * 864e5);
  const short = (date: Date) =>
    date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });

  return `${short(start)} – ${short(end)}`;
};

export default formatSalesPeriod;
