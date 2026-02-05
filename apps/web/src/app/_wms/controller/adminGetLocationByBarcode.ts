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

    // Clean the barcode - trim whitespace and normalize
    const cleanBarcode = barcode.trim();

    console.log('[getLocationByBarcode] Input:', {
      original: barcode,
      cleaned: cleanBarcode,
      length: cleanBarcode.length,
      charCodes: cleanBarcode.split('').map(c => c.charCodeAt(0))
    });

    // Find the location by barcode first, then try locationCode
    let [location] = await db
      .select()
      .from(wmsLocations)
      .where(eq(wmsLocations.barcode, cleanBarcode));

    console.log('[getLocationByBarcode] Barcode match result:', location?.id ?? 'not found');

    // If not found by barcode, try matching by locationCode
    if (!location) {
      // Try with and without "LOC-" prefix
      const codeToTry = cleanBarcode.startsWith('LOC-') ? cleanBarcode.slice(4) : cleanBarcode;
      console.log('[getLocationByBarcode] Trying locationCode:', codeToTry);
      [location] = await db
        .select()
        .from(wmsLocations)
        .where(eq(wmsLocations.locationCode, codeToTry));
      console.log('[getLocationByBarcode] LocationCode match result:', location?.id ?? 'not found');
    }

    // Also try the full barcode as locationCode
    if (!location) {
      console.log('[getLocationByBarcode] Trying full barcode as locationCode:', cleanBarcode);
      [location] = await db
        .select()
        .from(wmsLocations)
        .where(eq(wmsLocations.locationCode, cleanBarcode));
      console.log('[getLocationByBarcode] Full barcode as locationCode result:', location?.id ?? 'not found');
    }

    if (!location) {
      console.log('[getLocationByBarcode] Location not found for:', cleanBarcode);
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Location not found: ${cleanBarcode}`,
      });
    }

    console.log('[getLocationByBarcode] Found location:', { id: location.id, code: location.locationCode, barcode: location.barcode });

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
        caseConfig: wmsStock.caseConfig,
        bottleSize: wmsStock.bottleSize,
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
