import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single shipment with its items for WMS receiving
 *
 * @example
 *   await trpcClient.wms.admin.receiving.getShipmentForReceiving.query({ shipmentId: "uuid" });
 */
const adminGetShipmentForReceiving = adminProcedure
  .input(z.object({ shipmentId: z.string().uuid() }))
  .query(async ({ input }) => {
    // Get the shipment with partner info
    const [shipmentResult] = await db
      .select({
        id: logisticsShipments.id,
        shipmentNumber: logisticsShipments.shipmentNumber,
        status: logisticsShipments.status,
        type: logisticsShipments.type,
        partnerId: logisticsShipments.partnerId,
        partnerName: partners.businessName,
        originCountry: logisticsShipments.originCountry,
        originCity: logisticsShipments.originCity,
        totalCases: logisticsShipments.totalCases,
        totalBottles: logisticsShipments.totalBottles,
        eta: logisticsShipments.eta,
        ata: logisticsShipments.ata,
        internalNotes: logisticsShipments.internalNotes,
      })
      .from(logisticsShipments)
      .leftJoin(partners, eq(logisticsShipments.partnerId, partners.id))
      .where(eq(logisticsShipments.id, input.shipmentId));

    if (!shipmentResult) {
      return null;
    }

    // Get the shipment items
    const items = await db
      .select({
        id: logisticsShipmentItems.id,
        productName: logisticsShipmentItems.productName,
        lwin: logisticsShipmentItems.lwin,
        producer: logisticsShipmentItems.producer,
        vintage: logisticsShipmentItems.vintage,
        region: logisticsShipmentItems.region,
        countryOfOrigin: logisticsShipmentItems.countryOfOrigin,
        cases: logisticsShipmentItems.cases,
        bottlesPerCase: logisticsShipmentItems.bottlesPerCase,
        bottleSizeMl: logisticsShipmentItems.bottleSizeMl,
        totalBottles: logisticsShipmentItems.totalBottles,
        hsCode: logisticsShipmentItems.hsCode,
      })
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, input.shipmentId))
      .orderBy(logisticsShipmentItems.sortOrder);

    return {
      ...shipmentResult,
      items,
    };
  });

export default adminGetShipmentForReceiving;
