import { format, isValid } from 'date-fns';

type DateInput = Date | string | number | null | undefined;

const toDate = (value: DateInput) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : null;
};

/**
 * House date format, e.g. "4 Nov 2026". Returns the fallback for empty or
 * unparseable input instead of throwing.
 */
export const formatDate = (value: DateInput, fallback = '—') => {
  const date = toDate(value);
  return date ? format(date, 'd MMM yyyy') : fallback;
};

/** House date and time format, e.g. "4 Nov 2026, 14:05" */
export const formatDateTime = (value: DateInput, fallback = '—') => {
  const date = toDate(value);
  return date ? format(date, 'd MMM yyyy, HH:mm') : fallback;
};

export default formatDate;
