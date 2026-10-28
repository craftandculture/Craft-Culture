import { and, eq, inArray, sql } from 'drizzle-orm';

import lwinPakKey, { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import {
  cellarPurchaseItems,
  cellarPurchases,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';

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
 * Wine the member imported is valued from their own shipment lines first. The
 * shared lookup takes the highest cost for a wine across every owner's
 * shipments and the pricing record, so a member holding a wine C&C or a
 * partner also holds could be shown that owner's cost. The shared figure is
 * used only when a caller asks for it (`sharedFallback`), for the release
 * quote's duty base, and never for a value shown per bottle.
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
const getMemberValuePerBottle = async (
  partnerId: string,
  lwins: string[],
  options: {
    /** Kept for older callers; own-only is now the default for everyone */
    ownOnly?: boolean;
    /**
     * Fall back to the shared cost (the highest across every owner and C&C's
     * pricing row) for wine with no shipment or purchase of the holder's own.
     * Only for figures the member never sees per bottle — the release quote's
     * duty base — never for a value shown on their screen.
     */
    sharedFallback?: boolean;
  } = {},
) => {
  /*
    Own figures only unless asked. The shared cost is another owner's figure,
    or ours, when the holder shipped none of that wine — and sending it to a
    member's or a partner's browser showed someone else's cost.
  */
  const values =
    options.sharedFallback && !options.ownOnly
      ? await getCostPerBottle(lwins)
      : new Map<string, number>();

  if (lwins.length === 0) return values;

  const keys = [...new Set(lwins.map((lwin) => lwinPakKeyOf(lwin)))];

  const ownShipped = await db
    .select({
      key: sql<string>`${lwinPakKey(logisticsShipmentItems.lwin)}`,
      cost: sql<number | null>`NULLIF(MAX(${logisticsShipmentItems.productCostPerBottle}), 0)`,
    })
    .from(logisticsShipmentItems)
    .innerJoin(logisticsShipments, eq(logisticsShipments.id, logisticsShipmentItems.shipmentId))
    .where(
      and(
        sql`COALESCE(${logisticsShipmentItems.overrideOwnerId}, ${logisticsShipments.partnerId}) = ${partnerId}`,
        inArray(sql`${lwinPakKey(logisticsShipmentItems.lwin)}`, keys),
      ),
    )
    .groupBy(sql`${lwinPakKey(logisticsShipmentItems.lwin)}`);

  for (const row of ownShipped) {
    if (row.cost) values.set(row.key, Number(row.cost));
  }

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
