import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { wmsPartnerRequests } from '@/database/schema';

/**
 * Next request number for the year
 *
 * @example
 *   await generateRequestNumber(); // 'REQ-2026-0007'
 *
 * @returns A sequential, year-scoped request reference
 */
const generateRequestNumber = async () => {
  const prefix = `REQ-${new Date().getFullYear()}-`;

  const [latest] = await db
    .select({ requestNumber: wmsPartnerRequests.requestNumber })
    .from(wmsPartnerRequests)
    .where(like(wmsPartnerRequests.requestNumber, `${prefix}%`))
    .orderBy(desc(wmsPartnerRequests.requestNumber))
    .limit(1);

  const next = latest
    ? parseInt(latest.requestNumber.replace(prefix, ''), 10) + 1
    : 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
};

export default generateRequestNumber;
