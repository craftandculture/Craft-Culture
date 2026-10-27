import nextYearNumber, {
  type NumberExecutor,
} from '@/app/_cellar/utils/nextYearNumber';
import db from '@/database/client';
import { cellarUkMoves } from '@/database/schema';

/**
 * Next UK move number for the year
 *
 * Also the "Your Ref" on LCB's export order, so the order and the request can
 * be matched without a lookup.
 *
 * @example
 *   await generateUkMoveNumber(); // 'UKM-2026-0001'
 *
 * @param executor - The database, or the transaction the insert runs in
 * @param offset - Steps past the next free number, after a clash (see withNumberRetry)
 * @returns A sequential, year-scoped reference
 */
const generateUkMoveNumber = (executor: NumberExecutor = db, offset = 0) =>
  nextYearNumber(executor, cellarUkMoves, cellarUkMoves.moveNumber, 'UKM', offset);

export default generateUkMoveNumber;
