import { eq, sql } from 'drizzle-orm';

import { wmsStock } from '@/database/schema';

// The SQL below is planGiveBack's arithmetic; change one, change both

/**
 * Give a released hold's cases back to its stock row
 *
 * The one write every hold release uses, so available can never exceed the
 * shelf less what is still held, whichever path releases. Both expressions
 * read the row as it was before the update (Postgres evaluates SET against the
 * old row), which is why the new reserved figure is written out again inside
 * the available cap.
 *
 * @example
 *   await giveBackHeldCases({ db: tx, stockId: hold.stockId, cases: held.quantityCases });
 *
 * @param params.db - Drizzle handle (use the surrounding transaction)
 * @param params.stockId - The row the hold sat on
 * @param params.cases - The size of the hold, as claimed
 */
const giveBackHeldCases = async ({
  db,
  stockId,
  cases,
  now = new Date(),
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  stockId: string;
  cases: number;
  now?: Date;
}) => {
  if (!(cases > 0)) return;

  await db
    .update(wmsStock)
    .set({
      reservedCases: sql`GREATEST(${wmsStock.reservedCases} - ${cases}, 0)`,
      availableCases: sql`LEAST(${wmsStock.availableCases} + ${cases}, GREATEST(${wmsStock.quantityCases} - GREATEST(${wmsStock.reservedCases} - ${cases}, 0), 0))`,
      updatedAt: now,
    })
    .where(eq(wmsStock.id, stockId));
};

export default giveBackHeldCases;
