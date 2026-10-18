import { and, inArray, sql } from 'drizzle-orm';

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
    /*
      Only rows still owned by whoever the shipment delivered to — the
      shipment's partner, or a line's own owner where receiving overrode it.
      Wine that has since changed hands is not the shipment's to decide: a
      cellar member who bought a case from us holds it not-for-sale, and
      recomputing every row of the shipment put that case back on our lists
      the next time anyone touched the shipment's availability.
    */
    .where(
      and(
        inArray(wmsStock.shipmentId, shipmentIds),
        sql`${wmsStock.ownerId} IN (
          SELECT ${logisticsShipments.partnerId}
          FROM ${logisticsShipments}
          WHERE ${logisticsShipments.id} = ${wmsStock.shipmentId}
            AND ${logisticsShipments.partnerId} IS NOT NULL
          UNION
          SELECT ${logisticsShipmentItems.overrideOwnerId}
          FROM ${logisticsShipmentItems}
          WHERE ${logisticsShipmentItems.shipmentId} = ${wmsStock.shipmentId}
            AND ${logisticsShipmentItems.lwin} = ${wmsStock.lwin18}
            AND ${logisticsShipmentItems.overrideOwnerId} IS NOT NULL
        )`,
      ),
    )
    .returning({ id: wmsStock.id });

  return rows.length;
};

export default syncReceivedAvailability;
