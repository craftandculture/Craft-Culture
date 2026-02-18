import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';

import db from '@/database/client';
import { wmsCaseLabels, wmsLocations, wmsStock, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { putawaySchema } from '../schemas/putawaySchema';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Put away a case from receiving to a storage location
 * Moves a single case by scanning its barcode and destination location
 *
 * @example
 *   await trpcClient.wms.admin.operations.putaway.mutate({
 *     caseBarcode: "CASE-1010279-2015-06-00750-001",
 *     toLocationId: "uuid-of-location"
 *   });
 */
const adminPutaway = adminProcedure
  .input(putawaySchema)
  .mutation(async ({ input, ctx }) => {
    const { caseBarcode, toLocationId, notes } = input;

    // 1. Find the case label
    const [caseLabel] = await db
      .select()
      .from(wmsCaseLabels)
      .where(eq(wmsCaseLabels.barcode, caseBarcode));

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

    // 2. Get the current location (should be in receiving)
    const fromLocationId = caseLabel.currentLocationId;
    let fromLocation = null;

    if (fromLocationId) {
      const [location] = await db
        .select()
        .from(wmsLocations)
        .where(eq(wmsLocations.id, fromLocationId));

      fromLocation = location ?? null;
    }

    // 3. Validate the destination location exists
    const [toLocation] = await db
      .select()
      .from(wmsLocations)
      .where(eq(wmsLocations.id, toLocationId));

    if (!toLocation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Destination location not found',
      });
    }

    if (!toLocation.isActive) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Destination location is not active',
      });
    }

    // 4. Check if the case is already at the destination
    if (fromLocationId === toLocationId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Case is already at this location',
      });
    }

    // 5. Find the stock record for this case and update quantities
    // First, decrease quantity at the source location
    if (fromLocationId) {
      const [sourceStock] = await db
        .select()
        .from(wmsStock)
        .where(
          and(eq(wmsStock.locationId, fromLocationId), eq(wmsStock.lwin18, caseLabel.lwin18)),
        );

      if (sourceStock && sourceStock.quantityCases > 0) {
        await db
          .update(wmsStock)
          .set({
            quantityCases: sourceStock.quantityCases - 1,
            availableCases: Math.max(0, sourceStock.availableCases - 1),
            updatedAt: new Date(),
          })
          .where(eq(wmsStock.id, sourceStock.id));

        // Delete stock record if quantity is now 0
        if (sourceStock.quantityCases - 1 === 0) {
          await db.delete(wmsStock).where(eq(wmsStock.id, sourceStock.id));
        }
      }
    }

    // 6. Add or update stock at the destination location
    const [existingDestStock] = await db
      .select()
      .from(wmsStock)
      .where(
        and(
          eq(wmsStock.locationId, toLocationId),
          eq(wmsStock.lwin18, caseLabel.lwin18),
          caseLabel.lotNumber === null
            ? isNull(wmsStock.lotNumber)
            : eq(wmsStock.lotNumber, caseLabel.lotNumber),
        ),
      );

    if (existingDestStock) {
      // Update existing stock record
      await db
        .update(wmsStock)
        .set({
          quantityCases: existingDestStock.quantityCases + 1,
          availableCases: existingDestStock.availableCases + 1,
          updatedAt: new Date(),
        })
        .where(eq(wmsStock.id, existingDestStock.id));
    } else {
      // Need to get owner info from source stock or case label
      let ownerId = ctx.user.id;
      let ownerName = 'Craft & Culture';
      let producer = null;
      let vintage = null;
      let bottleSize = '750ml';
      let caseConfig = 12;
      let shipmentId = caseLabel.shipmentId;

      if (fromLocationId) {
        const [sourceStock] = await db
          .select()
          .from(wmsStock)
          .where(
            and(eq(wmsStock.locationId, fromLocationId), eq(wmsStock.lwin18, caseLabel.lwin18)),
          );

        if (sourceStock) {
          ownerId = sourceStock.ownerId;
          ownerName = sourceStock.ownerName;
          producer = sourceStock.producer;
          vintage = sourceStock.vintage;
          bottleSize = sourceStock.bottleSize ?? '750ml';
          caseConfig = sourceStock.caseConfig ?? 12;
          shipmentId = sourceStock.shipmentId;
        }
      }

      // Create new stock record at destination
      await db.insert(wmsStock).values({
        locationId: toLocationId,
        ownerId,
        ownerName,
        lwin18: caseLabel.lwin18,
        productName: caseLabel.productName,
        producer,
        vintage,
        bottleSize,
        caseConfig,
        quantityCases: 1,
        reservedCases: 0,
        availableCases: 1,
        lotNumber: caseLabel.lotNumber,
        receivedAt: new Date(),
        shipmentId,
        salesArrangement: 'consignment',
      });
    }

    // 7. Update case label location
    await db
      .update(wmsCaseLabels)
      .set({
        currentLocationId: toLocationId,
        updatedAt: new Date(),
      })
      .where(eq(wmsCaseLabels.id, caseLabel.id));

    // 8. Create movement record
    const movementNumber = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber,
      movementType: 'putaway',
      lwin18: caseLabel.lwin18,
      productName: caseLabel.productName,
      quantityCases: 1,
      fromLocationId,
      toLocationId,
      lotNumber: caseLabel.lotNumber,
      shipmentId: caseLabel.shipmentId,
      scannedBarcodes: [caseBarcode],
      notes: notes ?? `Put away to ${toLocation.locationCode}`,
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    return {
      success: true,
      caseBarcode,
      fromLocation: fromLocation
        ? {
            id: fromLocation.id,
            locationCode: fromLocation.locationCode,
          }
        : null,
      toLocation: {
        id: toLocation.id,
        locationCode: toLocation.locationCode,
      },
      productName: caseLabel.productName,
      movementNumber,
    };
  });

export default adminPutaway;
