import { desc, like } from 'drizzle-orm';

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
 * @returns A sequential, year-scoped reference
 */
const generateUkMoveNumber = async () => {
  const prefix = `UKM-${new Date().getFullYear()}-`;

  const [latest] = await db
    .select({ moveNumber: cellarUkMoves.moveNumber })
    .from(cellarUkMoves)
    .where(like(cellarUkMoves.moveNumber, `${prefix}%`))
    .orderBy(desc(cellarUkMoves.moveNumber))
    .limit(1);

  const next = latest
    ? parseInt(latest.moveNumber.replace(prefix, ''), 10) + 1
    : 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
};

export default generateUkMoveNumber;
