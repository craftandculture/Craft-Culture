import nextYearNumber, {
  type NumberExecutor,
} from '@/app/_cellar/utils/nextYearNumber';
import db from '@/database/client';
import { saleMandates } from '@/database/schema';

/**
 * Next mandate number for the year
 *
 * Max-plus-one, matching the fifteen other generators in this codebase. It is
 * not race-safe: two members offering wine in the same few milliseconds would
 * compute the same number and one would fail on the unique constraint. The
 * caller retries rather than losing the offer, which is the cheapest honest fix
 * short of moving every generator in the codebase onto a sequence.
 *
 * @example
 *   await generateMandateNumber(); // 'MND-2026-0007'
 *
 * @param executor - The database, or the transaction the insert runs in
 * @param offset - Steps past the next free number, after a clash (see withNumberRetry)
 * @returns A sequential, year-scoped mandate reference
 */
const generateMandateNumber = (executor: NumberExecutor = db, offset = 0) =>
  nextYearNumber(executor, saleMandates, saleMandates.mandateNumber, 'MND', offset);

export default generateMandateNumber;
