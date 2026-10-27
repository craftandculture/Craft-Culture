/**
 * A date as the order emails print it, in Gulf time
 *
 * @example
 *   formatGulfDate(new Date('2026-10-29T08:00:00Z'), 'short'); // 'Thu 29 Oct'
 *   formatGulfDate(new Date('2026-10-29T08:00:00Z'), 'long'); // 'Thursday 29 October 2026'
 *
 * @param date - The moment
 * @param style - Short for timelines, long for sentences
 * @returns The formatted date
 */
const formatGulfDate = (date: Date, style: 'short' | 'long') =>
  style === 'short'
    ? date.toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai', weekday: 'short', day: 'numeric', month: 'short' })
    : date.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Dubai',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

export default formatGulfDate;
