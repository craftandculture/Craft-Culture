import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsCaseLabels, wmsLocations, wmsStock, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { transferStockSchema } from '../schemas/transferSchema';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Transfer stock (multiple cases) between locations
 * Used when moving stock from one bin to another
 *
 * @example
 *   await trpcClient.wms.admin.operations.transferStock.mutate({
 *     stockId: "uuid",
 *     quantityCases: 5,
 *     toLocationId: "uuid"
 *   });
 */
const adminTransferStock = adminProcedure
  .input(transferStockSchema)
  .mutation(async ({ input, ctx }) => {
    const { stockId, quantityCases, toLocationId, notes } = input;

    // 1. Get the source stock record
    const [sourceStock] = await db.select().from(wmsStock).where(eq(wmsStock.id, stockId));

    if (!sourceStock) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Stock record not found',
      });
    }

    // 2. Validate quantity
    if (quantityCases > sourceStock.availableCases) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Only ${sourceStock.availableCases} cases available to transfer (${sourceStock.reservedCases} reserved)`,
      });
    }

    // 3. Get source location
    const [fromLocation] = await db
      .select()
      .from(wmsLocations)
      .where(eq(wmsLocations.id, sourceStock.locationId));

    if (!fromLocation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Source location not found',
      });
    }

    // 4. Validate destination location
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

    // 5. Check if transferring to same location
    if (sourceStock.locationId === toLocationId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Stock is already at this location',
      });
    }

    // 6. Update source stock (decrease quantity)
    const newSourceQuantity = sourceStock.quantityCases - quantityCases;
    const newSourceAvailable = sourceStock.availableCases - quantityCases;

    if (newSourceQuantity === 0) {
      // Delete the stock record if no cases remain
      await db.delete(wmsStock).where(eq(wmsStock.id, stockId));
    } else {
      await db
        .update(wmsStock)
        .set({
          quantityCases: newSourceQuantity,
          availableCases: newSourceAvailable,
          updatedAt: new Date(),
        })
        .where(eq(wmsStock.id, stockId));
    }

    // 7. Check if destination already has this stock (same LWIN, lot, owner)
    const [existingDestStock] = await db
      .select()
      .from(wmsStock)
      .where(
        and(
          eq(wmsStock.locationId, toLocationId),
          eq(wmsStock.lwin18, sourceStock.lwin18),
          eq(wmsStock.ownerId, sourceStock.ownerId),
          eq(wmsStock.lotNumber, sourceStock.lotNumber ?? ''),
        ),
      );

    let destStockId: string;

    if (existingDestStock) {
      // Update existing stock record
      await db
        .update(wmsStock)
        .set({
          quantityCases: existingDestStock.quantityCases + quantityCases,
          availableCases: existingDestStock.availableCases + quantityCases,
          updatedAt: new Date(),
        })
        .where(eq(wmsStock.id, existingDestStock.id));
      destStockId = existingDestStock.id;
    } else {
      // Create new stock record at destination
      const [newStock] = await db
        .insert(wmsStock)
        .values({
          locationId: toLocationId,
          ownerId: sourceStock.ownerId,
          ownerName: sourceStock.ownerName,
          lwin18: sourceStock.lwin18,
          productName: sourceStock.productName,
          producer: sourceStock.producer,
          vintage: sourceStock.vintage,
          bottleSize: sourceStock.bottleSize,
          caseConfig: sourceStock.caseConfig,
          quantityCases,
          reservedCases: 0,
          availableCases: quantityCases,
          lotNumber: sourceStock.lotNumber,
          receivedAt: sourceStock.receivedAt,
          shipmentId: sourceStock.shipmentId,
          salesArrangement: sourceStock.salesArrangement,
          consignmentCommissionPercent: sourceStock.consignmentCommissionPercent,
          expiryDate: sourceStock.expiryDate,
          isPerishable: sourceStock.isPerishable,
        })
        .returning();

      destStockId = newStock.id;
    }

    // 8. Update case labels for this product/lot to the new location
    // This updates up to quantityCases labels
    const casesToUpdate = await db
      .select()
      .from(wmsCaseLabels)
      .where(
        and(
          eq(wmsCaseLabels.currentLocationId, sourceStock.locationId),
          eq(wmsCaseLabels.lwin18, sourceStock.lwin18),
          eq(wmsCaseLabels.lotNumber, sourceStock.lotNumber ?? ''),
          eq(wmsCaseLabels.isActive, true),
        ),
      )
      .limit(quantityCases);

    const updatedBarcodes: string[] = [];
    for (const caseLabel of casesToUpdate) {
      await db
        .update(wmsCaseLabels)
        .set({
          currentLocationId: toLocationId,
          updatedAt: new Date(),
        })
        .where(eq(wmsCaseLabels.id, caseLabel.id));
      updatedBarcodes.push(caseLabel.barcode);
    }

    // 9. Create movement record
    const movementNumber = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber,
      movementType: 'transfer',
      lwin18: sourceStock.lwin18,
      productName: sourceStock.productName,
      quantityCases,
      fromLocationId: sourceStock.locationId,
      toLocationId,
      lotNumber: sourceStock.lotNumber,
      shipmentId: sourceStock.shipmentId,
      scannedBarcodes: updatedBarcodes,
      notes: notes ?? `Transfer from ${fromLocation.locationCode} to ${toLocation.locationCode}`,
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    return {
      success: true,
      quantityCases,
      fromLocation: {
        id: fromLocation.id,
        locationCode: fromLocation.locationCode,
      },
      toLocation: {
        id: toLocation.id,
        locationCode: toLocation.locationCode,
      },
      productName: sourceStock.productName,
      movementNumber,
      destStockId,
      sourceStockId: newSourceQuantity > 0 ? stockId : null,
      sourceRemaining: newSourceQuantity,
    };
  });

export default adminTransferStock;
