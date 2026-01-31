import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipments, partners, wmsCaseLabels, wmsLocations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get case labels for a shipment, ready for printing
 *
 * @example
 *   await trpcClient.wms.admin.labels.getCaseLabels.query({ shipmentId: "uuid" });
 */
const adminGetCaseLabels = adminProcedure
  .input(z.object({ shipmentId: z.string().uuid() }))
  .query(async ({ input }) => {
    // Get shipment info
    const [shipmentResult] = await db
      .select({
        shipmentNumber: logisticsShipments.shipmentNumber,
        partnerName: partners.name,
        originCountry: logisticsShipments.originCountry,
      })
      .from(logisticsShipments)
      .leftJoin(partners, eq(logisticsShipments.partnerId, partners.id))
      .where(eq(logisticsShipments.id, input.shipmentId));

    if (!shipmentResult) {
      return null;
    }

    // Get all case labels for this shipment
    const labels = await db
      .select({
        id: wmsCaseLabels.id,
        barcode: wmsCaseLabels.barcode,
        lwin18: wmsCaseLabels.lwin18,
        productName: wmsCaseLabels.productName,
        lotNumber: wmsCaseLabels.lotNumber,
        printedAt: wmsCaseLabels.printedAt,
        locationCode: wmsLocations.locationCode,
      })
      .from(wmsCaseLabels)
      .leftJoin(wmsLocations, eq(wmsCaseLabels.currentLocationId, wmsLocations.id))
      .where(eq(wmsCaseLabels.shipmentId, input.shipmentId))
      .orderBy(wmsCaseLabels.barcode);

    return {
      shipmentNumber: shipmentResult.shipmentNumber,
      partnerName: shipmentResult.partnerName,
      originCountry: shipmentResult.originCountry,
      labels,
      totalLabels: labels.length,
    };
  });

export default adminGetCaseLabels;
