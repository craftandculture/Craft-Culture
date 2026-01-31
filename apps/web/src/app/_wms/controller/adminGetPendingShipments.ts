import { desc, eq, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get shipments that are ready to be received in the WMS
 * Returns inbound shipments with status 'at_warehouse' or 'cleared'
 *
 * @example
 *   await trpcClient.wms.admin.receiving.getPendingShipments.query();
 */
const adminGetPendingShipments = adminProcedure.query(async () => {
  // Get inbound shipments that are at warehouse or cleared (ready to receive)
  const shipments = await db
    .select({
      id: logisticsShipments.id,
      shipmentNumber: logisticsShipments.shipmentNumber,
      status: logisticsShipments.status,
      partnerId: logisticsShipments.partnerId,
      partnerName: partners.name,
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
      inArray(logisticsShipments.status, ['at_warehouse', 'cleared']),
    )
    .groupBy(logisticsShipments.id, partners.name)
    .orderBy(desc(logisticsShipments.ata), desc(logisticsShipments.eta));

  return shipments;
});

export default adminGetPendingShipments;
