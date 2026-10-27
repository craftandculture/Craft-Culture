import nextYearNumber, {
  type NumberExecutor,
} from '@/app/_cellar/utils/nextYearNumber';
import db from '@/database/client';
import { consignmentSettlements } from '@/database/schema';

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
 * @param executor - The database, or the transaction the insert runs in
 * @param offset - Steps past the next free number, after a clash (see withNumberRetry)
 * @returns A sequential, year-scoped settlement reference
 */
const generateSettlementNumber = (executor: NumberExecutor = db, offset = 0) =>
  nextYearNumber(executor, consignmentSettlements, consignmentSettlements.settlementNumber, 'STL', offset);

export default generateSettlementNumber;
