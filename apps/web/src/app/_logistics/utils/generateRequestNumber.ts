import { count } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsQuoteRequests } from '@/database/schema';

/**
 * Generate a unique quote request number in the format QRQ-YYYY-XXXX
 *
 * @example
 *   generateRequestNumber(); // returns 'QRQ-2026-0001'
 *
 * @returns A unique quote request number string
 */
const generateRequestNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `QRQ-${year}-`;

  // Count existing requests for this year
  const [result] = await db
    .select({ count: count() })
    .from(logisticsQuoteRequests)
    .where((fields, { like }) => like(fields.requestNumber, `${prefix}%`));

  const nextNumber = (result?.count ?? 0) + 1;
  const paddedNumber = nextNumber.toString().padStart(4, '0');

  return `${prefix}${paddedNumber}`;
};

export default generateRequestNumber;
