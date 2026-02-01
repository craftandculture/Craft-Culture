import { desc, eq, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Get shipments that are ready to be received in the WMS
 * Returns inbound shipments with status 'at_warehouse' or 'cleared'
 *
 * @example
 *   await trpcClient.wms.admin.receiving.getPendingShipments.query();
 */
const adminGetPendingShipments = adminProcedure.query(async () => {
  // Debug: Check all shipments and their statuses including type
  const allShipments = await db
    .select({
      id: logisticsShipments.id,
      shipmentNumber: logisticsShipments.shipmentNumber,
      status: logisticsShipments.status,
      type: logisticsShipments.type,
    })
    .from(logisticsShipments)
    .orderBy(desc(logisticsShipments.createdAt))
    .limit(10);

  // Log for debugging - check Vercel logs
  logger.info('[WMS GetPendingShipments] All recent shipments:', {
    shipments: allShipments.map((s) => ({
      number: s.shipmentNumber,
      status: s.status,
      type: s.type,
    })),
  });

  // TEMPORARY: Log to console as well for easier debugging
  console.log('[WMS DEBUG] All shipments:', JSON.stringify(allShipments, null, 2));

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

  console.log('[WMS DEBUG] Filtered shipments:', shipments.length);

  // TEMPORARY: If no filtered shipments, return all shipments for debugging
  if (shipments.length === 0 && allShipments.length > 0) {
    console.log('[WMS DEBUG] No matching shipments, returning debug info');
    // Return debug info as a special shipment entry
    return allShipments.map((s) => ({
      id: s.id,
      shipmentNumber: `[DEBUG] ${s.shipmentNumber} (status: ${s.status}, type: ${s.type})`,
      status: s.status,
      partnerId: null,
      partnerName: null,
      originCountry: null,
      totalCases: 0,
      eta: null,
      ata: null,
      itemCount: 0,
    }));
  }

  return shipments;
});

export default adminGetPendingShipments;
