import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { consignmentPayoutRuns } from '@/database/schema';

/**
 * Next payout run number for the year
 *
 * @example
 *   await generateRunNumber(); // 'PAY-2026-0007'
 *
 * @returns A sequential, year-scoped run reference
 */
const generateRunNumber = async () => {
  const prefix = `PAY-${new Date().getFullYear()}-`;

  const [latest] = await db
    .select({ runNumber: consignmentPayoutRuns.runNumber })
    .from(consignmentPayoutRuns)
    .where(like(consignmentPayoutRuns.runNumber, `${prefix}%`))
    .orderBy(desc(consignmentPayoutRuns.runNumber))
    .limit(1);

  const next = latest
    ? parseInt(latest.runNumber.replace(prefix, ''), 10) + 1
    : 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
};

export default generateRunNumber;
