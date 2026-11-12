import { and, eq, sql } from 'drizzle-orm';

import { wmsStock, wmsStockReservations } from '@/database/schema';

import { casesToKeepOnRelease } from './planSharedHold';

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
  cases: releasedCases,
  now = new Date(),
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  stockId: string;
  cases: number;
  now?: Date;
}) => {
  let cases = releasedCases;
  if (!(cases > 0)) return;

  /*
    Other bottle orders may be sharing these cases (see planSharedHold). The
    release is claimed before this runs, so the active holds are the ones left;
    whatever they still need stays held, moved onto them, and only the rest is
    given back.
  */
  const [row]: { caseConfig: number | null }[] = await db
    .select({ caseConfig: wmsStock.caseConfig })
    .from(wmsStock)
    .where(eq(wmsStock.id, stockId));
  const pack = row?.caseConfig && row.caseConfig > 0 ? row.caseConfig : null;

  if (pack) {
    const active: { id: string; quantityCases: number; quantityBottles: number | null }[] = await db
      .select({
        id: wmsStockReservations.id,
        quantityCases: wmsStockReservations.quantityCases,
        quantityBottles: wmsStockReservations.quantityBottles,
      })
      .from(wmsStockReservations)
      .where(and(eq(wmsStockReservations.stockId, stockId), eq(wmsStockReservations.status, 'active')));

    let keep = casesToKeepOnRelease(active, pack, cases);
    const short = active
      .map((h) => ({ id: h.id, short: (h.quantityBottles ?? 0) - h.quantityCases * pack }))
      .filter((h) => h.short > 0)
      .sort((a, b) => b.short - a.short);

    for (const h of short) {
      if (keep <= 0) break;
      const take = Math.min(keep, Math.ceil(h.short / pack));
      await db
        .update(wmsStockReservations)
        .set({ quantityCases: sql`${wmsStockReservations.quantityCases} + ${take}`, updatedAt: now })
        .where(eq(wmsStockReservations.id, h.id));
      keep -= take;
      cases -= take;
    }

    if (!(cases > 0)) return;
  }

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
