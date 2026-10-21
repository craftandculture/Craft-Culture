import { and, eq, isNotNull, lt } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsQuotes } from '@/database/schema';

/**
 * Mark pending quotes whose validity has passed as expired
 *
 * Run with the morning digest, so the quote list and the request page stop
 * offering a price the forwarder no longer stands by. Accepting also refuses
 * a lapsed quote on its own, so nothing depends on this having run.
 *
 * @example
 *   await expireLapsedQuotes(); // 2
 *
 * @param now - The moment to judge by
 * @returns How many quotes were marked expired
 */
const expireLapsedQuotes = async (now = new Date()) => {
  const rows = await db
    .update(logisticsQuotes)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(
        eq(logisticsQuotes.status, 'pending'),
        isNotNull(logisticsQuotes.validUntil),
        lt(logisticsQuotes.validUntil, now),
      ),
    )
    .returning({ id: logisticsQuotes.id });

  return rows.length;
};

export default expireLapsedQuotes;
