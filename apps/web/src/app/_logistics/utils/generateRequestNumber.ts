import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsQuoteRequests } from '@/database/schema';

/**
 * Generate the next quote request number, QRQ-YYYY-NNNN
 *
 * The next after the highest on file this year, not a count of rows, so a
 * deleted request can never hand its number to a new one. Two saves in the
 * same moment can still pick the same number; callers retry on the unique
 * index (see `isUniqueViolation`).
 *
 * @example
 *   await generateRequestNumber(); // 'QRQ-2026-0013'
 *
 * @returns The next request number
 */
const generateRequestNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `QRQ-${year}-`;

  const [latest] = await db
    .select({ requestNumber: logisticsQuoteRequests.requestNumber })
    .from(logisticsQuoteRequests)
    .where(like(logisticsQuoteRequests.requestNumber, `${prefix}%`))
    .orderBy(desc(logisticsQuoteRequests.requestNumber))
    .limit(1);

  const last = Number(latest?.requestNumber.slice(prefix.length)) || 0;

  return `${prefix}${(last + 1).toString().padStart(4, '0')}`;
};

export default generateRequestNumber;
