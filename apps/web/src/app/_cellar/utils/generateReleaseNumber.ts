import nextYearNumber, {
  type NumberExecutor,
} from '@/app/_cellar/utils/nextYearNumber';
import db from '@/database/client';
import { cellarReleaseRequests } from '@/database/schema';

/**
 * Next release request number for the year
 *
 * @example
 *   await generateReleaseNumber(); // 'REL-2026-0007'
 *
 * @param executor - The database, or the transaction the insert runs in
 * @param offset - Steps past the next free number, after a clash (see withNumberRetry)
 * @returns A sequential, year-scoped reference
 */
const generateReleaseNumber = (executor: NumberExecutor = db, offset = 0) =>
  nextYearNumber(executor, cellarReleaseRequests, cellarReleaseRequests.requestNumber, 'REL', offset);

export default generateReleaseNumber;
