/**
 * Format a quote date the way the template writes it, e.g. "26 August 2026".
 *
 * Dates are held as date-only columns, so they are read in UTC to stop a
 * local timezone shifting the day backwards.
 *
 * @param value - A Date, an ISO/date string, or null
 * @returns The formatted date, an em dash when absent, or the raw input if unparseable
 */
const formatQuoteDate = (value: Date | string | null | undefined) => {
  if (!value) return '—';

  const date =
    typeof value === 'string'
      ? new Date(`${value.slice(0, 10)}T00:00:00Z`)
      : value;

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export default formatQuoteDate;
