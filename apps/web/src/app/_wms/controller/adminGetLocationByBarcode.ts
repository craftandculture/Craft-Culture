import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getLocationByBarcodeSchema } from '../schemas/transferSchema';

/**
 * Get location details by scanning a barcode
 * Used in transfer, put-away, and other mobile workflows
 *
 * @example
 *   await trpcClient.wms.admin.operations.getLocationByBarcode.query({
 *     barcode: "LOC-A-01-02"
 *   });
 */
const adminGetLocationByBarcode = adminProcedure
  .input(getLocationByBarcodeSchema)
  .query(async ({ input }) => {
    const { barcode } = input;

    // Find the location
    const [location] = await db
      .select()
      .from(wmsLocations)
      .where(eq(wmsLocations.barcode, barcode));

    if (!location) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Location not found with this barcode',
      });
    }

    if (!location.isActive) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This location is not active',
      });
    }

    // Get stock summary at this location
    const stockAtLocation = await db
      .select({
        id: wmsStock.id,
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        ownerName: wmsStock.ownerName,
        quantityCases: wmsStock.quantityCases,
        availableCases: wmsStock.availableCases,
        lotNumber: wmsStock.lotNumber,
      })
      .from(wmsStock)
      .where(eq(wmsStock.locationId, location.id));

    const totalCases = stockAtLocation.reduce((sum, s) => sum + s.quantityCases, 0);

    return {
      location: {
        id: location.id,
        locationCode: location.locationCode,
        barcode: location.barcode,
        aisle: location.aisle,
        bay: location.bay,
        level: location.level,
        locationType: location.locationType,
        requiresForklift: location.requiresForklift,
        capacityCases: location.capacityCases,
      },
      stock: stockAtLocation,
      totalCases,
    };
  });

export default adminGetLocationByBarcode;
