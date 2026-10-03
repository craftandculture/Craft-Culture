/**
 * Move a due date on by one repeat period
 *
 * Used when a repeating job is closed and its next one is created.
 *
 * @example
 *   shiftDue('2026-10-31', 'monthly'); // '2026-11-30'
 *
 * @param iso - The current due date, `YYYY-MM-DD`
 * @param repeat - 'weekly' or 'monthly'
 * @returns The next due date
 */
const shiftDue = (iso: string, repeat: 'weekly' | 'monthly') => {
  const d = new Date(`${iso}T12:00:00Z`);

  if (repeat === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));

  return d.toISOString().slice(0, 10);
};

export default shiftDue;
