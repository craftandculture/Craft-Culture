import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { consignmentSettlements } from '@/database/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Next settlement number for the year
 *
 * @example
 *   await generateSettlementNumber(); // 'STL-2026-0007'
 *
 * Pass the open transaction when writing settlements inside one. Read through
 * the shared connection, a second settlement in the same transaction cannot
 * see the first, takes the same number and fails the unique key — so a cellar
 * purchase with two lines that settle (two partners, or a partner and a
 * member) could never be confirmed.
 *
 * @param executor - The open transaction, or the shared connection
 * @returns A sequential, year-scoped settlement reference
 */
const generateSettlementNumber = async (executor: Tx | typeof db = db) => {
  const prefix = `STL-${new Date().getFullYear()}-`;

  const [latest] = await executor
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
