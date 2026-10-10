import { eq, inArray, sql } from 'drizzle-orm';

import resolveTradePrices from '@/app/_privateClientOrders/utils/resolveTradePrices';
import INBOUND_SHIPMENT_STATUSES from '@/app/_wms/utils/inboundShipmentStatuses';
import lwinPakKey, { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments, wmsStock } from '@/database/schema';

/**
 * What every check reads against: the in-bond price list and the wine we hold
 *
 * The price list is the one already published to trade clients (and used to
 * flag below-trade lines when a PCO becomes a sales order), per bottle and
 * keyed without the pack, so a 3-pack line is checked against 6-pack stock.
 * Stock counts bottles on hand plus those on the water.
 *
 * @returns Maps keyed by lwinPakKey (wine-vintage-size)
 */
const loadCheckContext = async () => {
  const [prices, onHand, inbound] = await Promise.all([
    resolveTradePrices(),
    db
      .select({
        key: sql<string>`${lwinPakKey(wmsStock.lwin18)}`,
        bottles: sql<number>`sum(${wmsStock.quantityCases} * coalesce(${wmsStock.caseConfig}, 1) + ${wmsStock.openBottles})::int`,
      })
      .from(wmsStock)
      .groupBy(sql`1`),
    db
      .select({
        lwin: logisticsShipmentItems.lwin,
        bottles: sql<number>`sum(coalesce(nullif(${logisticsShipmentItems.totalBottles}, 0), coalesce(${logisticsShipmentItems.cases}, 0) * coalesce(${logisticsShipmentItems.bottlesPerCase}, 12)))::int`,
      })
      .from(logisticsShipmentItems)
      .innerJoin(logisticsShipments, eq(logisticsShipments.id, logisticsShipmentItems.shipmentId))
      .where(inArray(logisticsShipments.status, [...INBOUND_SHIPMENT_STATUSES]))
      .groupBy(logisticsShipmentItems.lwin),
  ]);

  const listPerBottle = new Map([...prices].map(([key, p]) => [key, p.perBottle]));
  const stockBottles = new Map<string, number>();
  for (const row of onHand) {
    if (row.bottles > 0) stockBottles.set(row.key, row.bottles);
  }
  for (const row of inbound) {
    if (!row.lwin || !(row.bottles > 0)) continue;
    const key = lwinPakKeyOf(normalizeLwin18(row.lwin));
    stockBottles.set(key, (stockBottles.get(key) ?? 0) + row.bottles);
  }

  return { listPerBottle, stockBottles };
};

export default loadCheckContext;
