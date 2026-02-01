import { count, like } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsQuotes } from '@/database/schema';

/**
 * Generate a unique quote number in the format QTE-YYYY-XXXX
 *
 * @example
 *   generateQuoteNumber(); // returns 'QTE-2026-0001'
 *
 * @returns A unique quote number string
 */
const generateQuoteNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `QTE-${year}-`;

  // Count existing quotes for this year
  const [result] = await db
    .select({ count: count() })
    .from(logisticsQuotes)
    .where(like(logisticsQuotes.quoteNumber, `${prefix}%`));

  const nextNumber = (result?.count ?? 0) + 1;
  const paddedNumber = nextNumber.toString().padStart(4, '0');

  return `${prefix}${paddedNumber}`;
};

export default generateQuoteNumber;
