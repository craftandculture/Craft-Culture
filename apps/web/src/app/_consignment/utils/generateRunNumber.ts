import nextYearNumber, {
  type NumberExecutor,
} from '@/app/_cellar/utils/nextYearNumber';
import db from '@/database/client';
import { consignmentPayoutRuns } from '@/database/schema';

/**
 * Next payout run number for the year
 *
 * @example
 *   await generateRunNumber(); // 'PAY-2026-0007'
 *
 * @param executor - The database, or the transaction the insert runs in
 * @param offset - Steps past the next free number, after a clash (see withNumberRetry)
 * @returns A sequential, year-scoped run reference
 */
const generateRunNumber = (executor: NumberExecutor = db, offset = 0) =>
  nextYearNumber(executor, consignmentPayoutRuns, consignmentPayoutRuns.runNumber, 'PAY', offset);

export default generateRunNumber;
