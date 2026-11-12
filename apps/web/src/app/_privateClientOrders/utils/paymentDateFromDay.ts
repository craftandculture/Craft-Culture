/**
 * The date a payment was made, from the day a person picked (YYYY-MM-DD)
 *
 * Stored at midday UTC so the day reads the same in Dubai and London; at
 * midnight UTC a 9 Apr payment would show as 8 Apr anywhere west of Greenwich.
 * A payment cannot be dated in the future, nor before C&C traded.
 *
 * @example
 *   paymentDateFromDay('2026-04-09'); // 2026-04-09T12:00:00.000Z
 *   paymentDateFromDay('2099-01-01'); // null
 *
 * @param day - The payment day, YYYY-MM-DD
 * @returns The date to store, or null when the day is not a valid payment day
 */
const paymentDateFromDay = (day: string, now: Date = new Date()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) return null;
  // A day ahead of UTC is still "today" in Dubai
  if (date.getTime() > now.getTime() + 24 * 60 * 60 * 1000) return null;
  if (date.getUTCFullYear() < 2023) return null;
  return date;
};

export default paymentDateFromDay;
