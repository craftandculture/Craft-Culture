/**
 * Today's date in Dubai as `YYYY-MM-DD`
 *
 * Due dates are calendar days for a team in the UAE, so "overdue" is judged
 * against Dubai's date, not the server's UTC one.
 *
 * @example
 *   dubaiToday(); // '2026-10-04'
 *
 * @param now - The moment to read, defaulting to now
 * @returns The Dubai calendar date
 */
const dubaiToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export default dubaiToday;
