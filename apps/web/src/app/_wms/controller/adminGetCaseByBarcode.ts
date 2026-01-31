import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsCaseLabels, wmsLocations, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getCaseByBarcodeSchema } from '../schemas/putawaySchema';

/**
 * Get case details by scanning a barcode
 * Used in put-away, transfer, and other mobile workflows
 *
 * @example
 *   await trpcClient.wms.admin.operations.getCaseByBarcode.query({
 *     barcode: "CASE-1010279-2015-06-00750-001"
 *   });
 */
const adminGetCaseByBarcode = adminProcedure
  .input(getCaseByBarcodeSchema)
  .query(async ({ input }) => {
    const { barcode } = input;

    // Find the case label
    const [caseLabel] = await db
      .select({
        id: wmsCaseLabels.id,
        barcode: wmsCaseLabels.barcode,
        lwin18: wmsCaseLabels.lwin18,
        productName: wmsCaseLabels.productName,
        lotNumber: wmsCaseLabels.lotNumber,
        shipmentId: wmsCaseLabels.shipmentId,
        currentLocationId: wmsCaseLabels.currentLocationId,
        isActive: wmsCaseLabels.isActive,
      })
      .from(wmsCaseLabels)
      .where(eq(wmsCaseLabels.barcode, barcode));

    if (!caseLabel) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Case not found with this barcode',
      });
    }

    if (!caseLabel.isActive) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This case is no longer active',
      });
    }

    // Get current location details if set
    let currentLocation = null;
    if (caseLabel.currentLocationId) {
      const [location] = await db
        .select({
          id: wmsLocations.id,
          locationCode: wmsLocations.locationCode,
          locationType: wmsLocations.locationType,
          aisle: wmsLocations.aisle,
          bay: wmsLocations.bay,
          level: wmsLocations.level,
        })
        .from(wmsLocations)
        .where(eq(wmsLocations.id, caseLabel.currentLocationId));

      currentLocation = location ?? null;
    }

    // Get stock details for additional info
    const stockRecords = await db
      .select({
        id: wmsStock.id,
        ownerId: wmsStock.ownerId,
        ownerName: wmsStock.ownerName,
        producer: wmsStock.producer,
        vintage: wmsStock.vintage,
        bottleSize: wmsStock.bottleSize,
        caseConfig: wmsStock.caseConfig,
        expiryDate: wmsStock.expiryDate,
      })
      .from(wmsStock)
      .where(eq(wmsStock.lwin18, caseLabel.lwin18));

    const stockInfo = stockRecords[0] ?? null;

    return {
      caseLabel: {
        id: caseLabel.id,
        barcode: caseLabel.barcode,
        lwin18: caseLabel.lwin18,
        productName: caseLabel.productName,
        lotNumber: caseLabel.lotNumber,
        shipmentId: caseLabel.shipmentId,
      },
      currentLocation,
      stockInfo: stockInfo
        ? {
            ownerId: stockInfo.ownerId,
            ownerName: stockInfo.ownerName,
            producer: stockInfo.producer,
            vintage: stockInfo.vintage,
            bottleSize: stockInfo.bottleSize,
            caseConfig: stockInfo.caseConfig,
            expiryDate: stockInfo.expiryDate,
          }
        : null,
    };
  });

export default adminGetCaseByBarcode;
