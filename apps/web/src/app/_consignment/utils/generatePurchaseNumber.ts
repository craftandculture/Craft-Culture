import nextYearNumber, {
  type NumberExecutor,
} from '@/app/_cellar/utils/nextYearNumber';
import db from '@/database/client';
import { cellarPurchases } from '@/database/schema';

/**
 * Next purchase number for the year
 *
 * Max-plus-one, like every other generator here, and not race-safe for the same
 * reason. The caller retries on the unique constraint.
 *
 * @example
 *   await generatePurchaseNumber(); // 'CPO-2026-0007'
 *
 * @param executor - The database, or the transaction the insert runs in
 * @param offset - Steps past the next free number, after a clash (see withNumberRetry)
 * @returns A sequential, year-scoped purchase reference
 */
const generatePurchaseNumber = (executor: NumberExecutor = db, offset = 0) =>
  nextYearNumber(executor, cellarPurchases, cellarPurchases.purchaseNumber, 'CPO', offset);

export default generatePurchaseNumber;
