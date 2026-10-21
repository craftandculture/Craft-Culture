import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsQuotes } from '@/database/schema';

/**
 * Generate the next freight quote number, QTE-YYYY-NNNN
 *
 * The next after the highest on file this year, not a count of rows, so a
 * deleted quote can never hand its number to a new one. Callers retry on the
 * unique index when two saves pick the same number (see `isUniqueViolation`).
 *
 * @example
 *   await generateQuoteNumber(); // 'QTE-2026-0042'
 *
 * @returns The next quote number
 */
const generateQuoteNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `QTE-${year}-`;

  const [latest] = await db
    .select({ quoteNumber: logisticsQuotes.quoteNumber })
    .from(logisticsQuotes)
    .where(like(logisticsQuotes.quoteNumber, `${prefix}%`))
    .orderBy(desc(logisticsQuotes.quoteNumber))
    .limit(1);

  const last = Number(latest?.quoteNumber.slice(prefix.length)) || 0;

  return `${prefix}${(last + 1).toString().padStart(4, '0')}`;
};

export default generateQuoteNumber;
