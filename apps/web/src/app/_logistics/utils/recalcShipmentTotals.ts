import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';

/**
 * Recompute a shipment's denormalized totals (cases, bottles, gross weight)
 * directly from its current line items.
 *
 * This is idempotent and drift-proof: call it after any item insert, update,
 * or delete instead of incrementally adjusting the counters. Incremental
 * `+=`/`-=` updates silently drift out of sync (they went negative in
 * production), whereas recomputing from the source of truth cannot.
 *
 * @param shipmentId - The shipment whose totals should be recomputed
 */
const recalcShipmentTotals = async (shipmentId: string) => {
  await db
    .update(logisticsShipments)
    .set({
      totalCases: sql`COALESCE((
        SELECT SUM(${logisticsShipmentItems.cases})
        FROM ${logisticsShipmentItems}
        WHERE ${logisticsShipmentItems.shipmentId} = ${shipmentId}
      ), 0)`,
      totalBottles: sql`COALESCE((
        SELECT SUM(COALESCE(
          ${logisticsShipmentItems.totalBottles},
          ${logisticsShipmentItems.cases} * COALESCE(${logisticsShipmentItems.bottlesPerCase}, 12)
        ))
        FROM ${logisticsShipmentItems}
        WHERE ${logisticsShipmentItems.shipmentId} = ${shipmentId}
      ), 0)`,
      totalWeightKg: sql`(
        SELECT SUM(${logisticsShipmentItems.grossWeightKg})
        FROM ${logisticsShipmentItems}
        WHERE ${logisticsShipmentItems.shipmentId} = ${shipmentId}
      )`,
      updatedAt: new Date(),
    })
    .where(eq(logisticsShipments.id, shipmentId));
};

export default recalcShipmentTotals;
