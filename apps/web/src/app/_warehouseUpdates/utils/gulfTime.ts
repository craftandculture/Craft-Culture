/** Gulf Standard Time is UTC+4 all year, with no daylight saving */
const GULF_OFFSET_MS = 4 * 60 * 60 * 1000;

/**
 * The Gulf-time calendar fields of a moment
 *
 * @example
 *   gulfTime(new Date('2026-11-19T07:30:00Z')); // { day: '2026-11-19', hour: 11, weekday: 4, ... }
 *
 * @param at - The moment
 * @returns The Gulf date, hour and weekday (0 = Sunday)
 */
const gulfTime = (at: Date) => {
  const shifted = new Date(at.getTime() + GULF_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(),
    day: shifted.toISOString().slice(0, 10),
  };
};

export default gulfTime;
