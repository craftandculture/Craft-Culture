import nextYearNumber, {
  type NumberExecutor,
} from '@/app/_cellar/utils/nextYearNumber';
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
 * @param executor - The database, or the transaction the insert runs in
 * @param offset - Steps past the next free number, after a clash (see withNumberRetry)
 * @returns A sequential, year-scoped request reference
 */
const generateSourcingNumber = (executor: NumberExecutor = db, offset = 0) =>
  nextYearNumber(executor, cellarSourcingRequests, cellarSourcingRequests.requestNumber, 'SRC', offset);

export default generateSourcingNumber;
