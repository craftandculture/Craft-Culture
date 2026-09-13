import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { cellarReleaseRequests } from '@/database/schema';

/**
 * Next release request number for the year
 *
 * @example
 *   await generateReleaseNumber(); // 'REL-2026-0007'
 *
 * @returns A sequential, year-scoped reference
 */
const generateReleaseNumber = async () => {
  const prefix = `REL-${new Date().getFullYear()}-`;

  const [latest] = await db
    .select({ requestNumber: cellarReleaseRequests.requestNumber })
    .from(cellarReleaseRequests)
    .where(like(cellarReleaseRequests.requestNumber, `${prefix}%`))
    .orderBy(desc(cellarReleaseRequests.requestNumber))
    .limit(1);

  const next = latest
    ? parseInt(latest.requestNumber.replace(prefix, ''), 10) + 1
    : 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
};

export default generateReleaseNumber;
