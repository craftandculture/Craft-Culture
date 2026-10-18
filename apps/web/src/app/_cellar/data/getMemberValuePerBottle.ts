import { and, eq, inArray, sql } from 'drizzle-orm';

import lwinPakKey, { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import { cellarPurchaseItems, cellarPurchases } from '@/database/schema';

import getCostPerBottle from './getCostPerBottle';

/**
 * What a bottle is worth to the member who holds it
 *
 * The value declared on import, except for wine the member bought from us:
 * that is valued at what they paid. Declared value on bought wine is C&C's own
 * cost, so showing it put our margin on the member's screen (Cervaro 2019
 * bought at $113.16 showed as about $90 a bottle) and into the goods value of
 * their delivery quote.
 *
 * Several purchases of one wine average by bottles. Keyed by `lwinPakKeyOf`,
 * like `getCostPerBottle`.
 *
 * @example
 *   const values = await getMemberValuePerBottle(partnerId, lwins);
 *   const value = values.get(lwinPakKeyOf(stock.lwin18)) ?? null;
 *
 * @param partnerId - The member whose cellar is being valued
 * @param lwins - The LWIN18s being valued
 * @returns Value per bottle, keyed pack-agnostically
 */
const getMemberValuePerBottle = async (partnerId: string, lwins: string[]) => {
  const values = await getCostPerBottle(lwins);

  if (lwins.length === 0) return values;

  const keys = [...new Set(lwins.map((lwin) => lwinPakKeyOf(lwin)))];

  const paid = await db
    .select({
      key: sql<string>`${lwinPakKey(cellarPurchaseItems.lwin18)}`,
      price: sql<number | null>`SUM(${cellarPurchaseItems.pricePerBottleUsd} * ${cellarPurchaseItems.bottles}) / NULLIF(SUM(${cellarPurchaseItems.bottles}), 0)`,
    })
    .from(cellarPurchaseItems)
    .innerJoin(cellarPurchases, eq(cellarPurchases.id, cellarPurchaseItems.purchaseId))
    .where(
      and(
        eq(cellarPurchases.buyerPartnerId, partnerId),
        eq(cellarPurchases.status, 'completed'),
        inArray(sql`${lwinPakKey(cellarPurchaseItems.lwin18)}`, keys),
      ),
    )
    .groupBy(sql`${lwinPakKey(cellarPurchaseItems.lwin18)}`);

  for (const row of paid) {
    if (row.price) values.set(row.key, Math.round(Number(row.price) * 100) / 100);
  }

  return values;
};

export default getMemberValuePerBottle;
