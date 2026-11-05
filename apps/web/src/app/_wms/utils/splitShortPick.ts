import { eq, sql } from 'drizzle-orm';

import { wmsPickListItems, wmsPickLists } from '@/database/schema';

import parseSkuPack from './parseSkuPack';

interface SplitShortPickParams {
  line: {
    id: string;
    pickListId: string;
    lwin18: string;
    productName: string;
    quantityCases: number;
    quantityBottles: number | null;
    suggestedLocationId: string | null;
    suggestedStockId: string | null;
  };
  /** Cases taken on a whole-case line, bottles on a split-case line */
  picked: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

/**
 * Keep the unpicked part of a short pick on the list as a line of its own
 *
 * A line for 3 cases picked as 1 was marked done, so the screen showed the
 * list complete and nobody was asked for the other 2. PL-2026-0166 shipped
 * three cases of Grand-Puy-Lacoste 2021 with one booked; the other two stayed
 * on A-05-00 in the system after they had left the building.
 *
 * The picked line is cut down to what was taken and the rest becomes a new
 * unpicked line for the same wine, sent to the same bay (the pick screen moves
 * it on if that bay can no longer cover it). The list's line count goes up by
 * one, so it cannot be completed until the remainder is picked.
 *
 * @example
 *   await splitShortPick({ line, picked: 1, db: tx }); // { quantity: 2, ... }
 *
 * @returns The remainder line, or null when nothing is left to pick
 */
const splitShortPick = async ({ line, picked, db }: SplitShortPickParams) => {
  const isBottleLine = line.quantityBottles != null;
  const wanted = isBottleLine ? (line.quantityBottles as number) : line.quantityCases;
  const left = wanted - picked;

  if (left <= 0) return null;

  const pack = parseSkuPack(line.lwin18)?.pack || 1;
  const casesFor = (bottles: number) => Math.ceil(bottles / pack);
  const unit = isBottleLine ? 'bottle(s)' : 'case(s)';

  await db
    .update(wmsPickListItems)
    .set(
      isBottleLine
        ? { quantityBottles: picked, quantityCases: casesFor(picked), updatedAt: new Date() }
        : { quantityCases: picked, updatedAt: new Date() },
    )
    .where(eq(wmsPickListItems.id, line.id));

  const [remainder] = await db
    .insert(wmsPickListItems)
    .values({
      pickListId: line.pickListId,
      lwin18: line.lwin18,
      productName: line.productName,
      quantityCases: isBottleLine ? casesFor(left) : left,
      quantityBottles: isBottleLine ? left : null,
      suggestedLocationId: line.suggestedLocationId,
      suggestedStockId: line.suggestedStockId,
      notes: `Remainder of a short pick: ${picked} of ${wanted} ${unit} taken`,
    })
    .returning({ id: wmsPickListItems.id });

  await db
    .update(wmsPickLists)
    .set({
      totalItems: sql`${wmsPickLists.totalItems} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(wmsPickLists.id, line.pickListId));

  return { id: remainder.id as string, quantity: left, unit };
};

export default splitShortPick;
