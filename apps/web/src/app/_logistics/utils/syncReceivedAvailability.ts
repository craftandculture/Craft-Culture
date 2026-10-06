import { inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments, wmsStock } from '@/database/schema';

/**
 * Make received stock say what its shipment and lines now say about sale.
 *
 * Receiving copies the answer onto the stock once — the line's own setting,
 * else the shipment's — and nothing carried a later change across. A line
 * held for its owner before landing stayed held on the shelf however the line
 * or the shipment was changed afterwards: SHP-2026-0018 was marked for sale,
 * released and priced, and none of its 68 wines reached a price list.
 *
 * Same rule as receiving, recomputed for every stock row the shipments hold,
 * so it is the one definition whichever control moved.
 *
 * @param shipmentIds - Shipments whose received stock should be brought in line
 */
const syncReceivedAvailability = async (shipmentIds: string[]) => {
  if (shipmentIds.length === 0) return 0;

  const rows = await db
    .update(wmsStock)
    .set({
      notForSale: sql`COALESCE(
        (
          SELECT BOOL_OR(${logisticsShipmentItems.notForSale})
          FROM ${logisticsShipmentItems}
          WHERE ${logisticsShipmentItems.shipmentId} = ${wmsStock.shipmentId}
            AND ${logisticsShipmentItems.lwin} = ${wmsStock.lwin18}
            AND ${logisticsShipmentItems.notForSale} IS NOT NULL
        ),
        (
          SELECT ${logisticsShipments.notForSale}
          FROM ${logisticsShipments}
          WHERE ${logisticsShipments.id} = ${wmsStock.shipmentId}
        ),
        ${wmsStock.notForSale}
      )`,
      updatedAt: new Date(),
    })
    .where(inArray(wmsStock.shipmentId, shipmentIds))
    .returning({ id: wmsStock.id });

  return rows.length;
};

export default syncReceivedAvailability;
