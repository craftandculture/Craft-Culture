import { format } from 'date-fns';

/**
 * Format a date using date-fns format strings
 *
 * @example
 *   formatDate(new Date(), 'PPpp'); // 'Apr 29, 2021, 12:00:00 AM'
 *   formatDate(new Date(), 'PP'); // 'Apr 29, 2021'
 *   formatDate(new Date(), 'p'); // '12:00 AM'
 *
 * @param date - The date to format
 * @param formatString - The format string (see date-fns documentation)
 * @returns The formatted date string
 */
const formatDate = (date: Date, formatString: string) => {
  return format(date, formatString);
};

export default formatDate;
