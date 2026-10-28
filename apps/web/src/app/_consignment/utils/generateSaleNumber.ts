import nextYearNumber, {
  type NumberExecutor,
} from '@/app/_cellar/utils/nextYearNumber';
import db from '@/database/client';
import { poolSales } from '@/database/schema';

/**
 * Next pool-sale number for the year
 *
 * Max-plus-one, matching every other generator here, and not race-safe for the
 * same reason. See [generateMandateNumber] — the caller retries on the unique
 * constraint rather than losing the record.
 *
 * @example
 *   await generateSaleNumber(); // 'PSL-2026-0007'
 *
 * @param executor - The database, or the transaction the insert runs in
 * @param offset - Steps past the next free number, after a clash (see withNumberRetry)
 * @returns A sequential, year-scoped sale reference
 */
const generateSaleNumber = (executor: NumberExecutor = db, offset = 0) =>
  nextYearNumber(executor, poolSales, poolSales.saleNumber, 'PSL', offset);

export default generateSaleNumber;
