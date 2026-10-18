import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { cellarSourcingRequests } from '@/database/schema';

/**
 * Next sourcing request number for the year
 *
 * Max-plus-one like the purchase numbers, and racy for the same reason; the
 * caller retries on the unique constraint.
 *
 * @example
 *   await generateSourcingNumber(); // 'SRC-2026-0003'
 *
 * @returns A sequential, year-scoped request reference
 */
const generateSourcingNumber = async () => {
  const prefix = `SRC-${new Date().getFullYear()}-`;

  const [latest] = await db
    .select({ requestNumber: cellarSourcingRequests.requestNumber })
    .from(cellarSourcingRequests)
    .where(like(cellarSourcingRequests.requestNumber, `${prefix}%`))
    .orderBy(desc(cellarSourcingRequests.requestNumber))
    .limit(1);

  const next = latest
    ? parseInt(latest.requestNumber.replace(prefix, ''), 10) + 1
    : 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
};

export default generateSourcingNumber;
