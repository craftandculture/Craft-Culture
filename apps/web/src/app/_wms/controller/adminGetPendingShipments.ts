import { desc, eq, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get shipments that are ready to be received in the WMS
 * Returns inbound shipments with status that indicates readiness for receiving
 *
 * @example
 *   await trpcClient.wms.admin.receiving.getPendingShipments.query();
 */
const adminGetPendingShipments = adminProcedure.query(async () => {
  // Get inbound shipments that are ready to receive
  // Includes: at_warehouse, cleared, customs_clearance, arrived_port
  const shipments = await db
    .select({
      id: logisticsShipments.id,
      shipmentNumber: logisticsShipments.shipmentNumber,
      status: logisticsShipments.status,
      partnerId: logisticsShipments.partnerId,
      partnerName: partners.businessName,
      originCountry: logisticsShipments.originCountry,
      totalCases: logisticsShipments.totalCases,
      eta: logisticsShipments.eta,
      ata: logisticsShipments.ata,
      itemCount: sql<number>`count(${logisticsShipmentItems.id})::int`,
    })
    .from(logisticsShipments)
    .leftJoin(partners, eq(logisticsShipments.partnerId, partners.id))
    .leftJoin(logisticsShipmentItems, eq(logisticsShipmentItems.shipmentId, logisticsShipments.id))
    .where(
      inArray(logisticsShipments.status, [
        'at_warehouse',
        'cleared',
        'customs_clearance',
        'arrived_port',
      ])
    )
    .groupBy(logisticsShipments.id, partners.businessName)
    .orderBy(desc(logisticsShipments.ata), desc(logisticsShipments.eta));

  return shipments;
});

export default adminGetPendingShipments;
