import { asc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get all stock records with full details for verification
 * Shows every stock record with location, product, and quantity
 *
 * @example
 *   await trpcClient.wms.admin.stock.getAll.query();
 */
const adminGetAllStockRecords = adminProcedure.query(async () => {
  const records = await db
    .select({
      id: wmsStock.id,
      locationCode: wmsLocations.locationCode,
      locationType: wmsLocations.locationType,
      lwin18: wmsStock.lwin18,
      productName: wmsStock.productName,
      producer: wmsStock.producer,
      vintage: wmsStock.vintage,
      bottleSize: wmsStock.bottleSize,
      caseConfig: wmsStock.caseConfig,
      quantityCases: wmsStock.quantityCases,
      availableCases: wmsStock.availableCases,
      reservedCases: wmsStock.reservedCases,
      ownerName: wmsStock.ownerName,
      lotNumber: wmsStock.lotNumber,
      receivedAt: wmsStock.receivedAt,
      shipmentId: wmsStock.shipmentId,
    })
    .from(wmsStock)
    .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
    .orderBy(asc(wmsLocations.locationCode), asc(wmsStock.productName));

  const totalCases = records.reduce((sum, r) => sum + r.quantityCases, 0);

  return {
    records,
    totalCases,
    recordCount: records.length,
  };
});

export default adminGetAllStockRecords;
