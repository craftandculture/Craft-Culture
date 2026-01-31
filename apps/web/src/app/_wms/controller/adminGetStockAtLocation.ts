import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getStockAtLocationSchema } from '../schemas/transferSchema';

/**
 * Get all stock at a specific location
 * Used in transfer workflow when selecting stock to move
 *
 * @example
 *   await trpcClient.wms.admin.operations.getStockAtLocation.query({
 *     locationId: "uuid"
 *   });
 */
const adminGetStockAtLocation = adminProcedure
  .input(getStockAtLocationSchema)
  .query(async ({ input }) => {
    const { locationId } = input;

    // Validate location exists
    const [location] = await db
      .select()
      .from(wmsLocations)
      .where(eq(wmsLocations.id, locationId));

    if (!location) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Location not found',
      });
    }

    // Get all stock at this location
    const stock = await db
      .select({
        id: wmsStock.id,
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        producer: wmsStock.producer,
        vintage: wmsStock.vintage,
        bottleSize: wmsStock.bottleSize,
        caseConfig: wmsStock.caseConfig,
        quantityCases: wmsStock.quantityCases,
        reservedCases: wmsStock.reservedCases,
        availableCases: wmsStock.availableCases,
        lotNumber: wmsStock.lotNumber,
        ownerId: wmsStock.ownerId,
        ownerName: wmsStock.ownerName,
        expiryDate: wmsStock.expiryDate,
        isPerishable: wmsStock.isPerishable,
      })
      .from(wmsStock)
      .where(eq(wmsStock.locationId, locationId))
      .orderBy(wmsStock.productName);

    const totalCases = stock.reduce((sum, s) => sum + s.quantityCases, 0);
    const totalAvailable = stock.reduce((sum, s) => sum + s.availableCases, 0);

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
      },
      stock,
      totalCases,
      totalAvailable,
    };
  });

export default adminGetStockAtLocation;
