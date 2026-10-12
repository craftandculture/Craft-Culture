/**
 * The current month in Dubai, as YYYY-MM
 *
 * @param now - The moment to read (defaults to now)
 */
const dubaiMonth = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit' }).format(now);

export default dubaiMonth;
