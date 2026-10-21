/**
 * Count UAE working days (Monday to Friday) from a date to now
 *
 * Used to decide when a forwarder is due a chase. Counts whole days passed,
 * skipping Saturdays and Sundays, in Dubai time.
 *
 * @example
 *   workingDaysSince(new Date('2026-10-15T09:00:00+04:00'), new Date('2026-10-20T09:00:00+04:00')); // 3
 *
 * @param from - When the clock started
 * @param now - Today, defaulting to the current time
 * @returns Working days elapsed
 */
const workingDaysSince = (from: Date, now = new Date()) => {
  const dubaiDay = (d: Date) => {
    const shifted = new Date(d.getTime() + 4 * 60 * 60 * 1000);

    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  };
  const end = dubaiDay(now);
  let days = 0;

  for (let t = dubaiDay(from) + 86_400_000; t <= end; t += 86_400_000) {
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days++;
  }

  return days;
};

export default workingDaysSince;
