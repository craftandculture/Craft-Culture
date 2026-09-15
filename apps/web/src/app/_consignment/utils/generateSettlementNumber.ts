import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { consignmentSettlements } from '@/database/schema';

/**
 * Next settlement number for the year
 *
 * @example
 *   await generateSettlementNumber(); // 'STL-2026-0007'
 *
 * @returns A sequential, year-scoped settlement reference
 */
const generateSettlementNumber = async () => {
  const prefix = `STL-${new Date().getFullYear()}-`;

  const [latest] = await db
    .select({ settlementNumber: consignmentSettlements.settlementNumber })
    .from(consignmentSettlements)
    .where(like(consignmentSettlements.settlementNumber, `${prefix}%`))
    .orderBy(desc(consignmentSettlements.settlementNumber))
    .limit(1);

  const next = latest
    ? parseInt(latest.settlementNumber.replace(prefix, ''), 10) + 1
    : 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
};

export default generateSettlementNumber;
