import { TRPCError } from '@trpc/server';
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  wmsCaseLabels,
  wmsLocations,
  wmsPickListItems,
  wmsPickLists,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { transferStockSchema } from '../schemas/transferSchema';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Transfer stock (multiple cases) between locations, e.g. moving stock from one
 * bin to another
 *
 * @example
 *   await trpcClient.wms.admin.operations.transferStock.mutate({
 *     stockId: 'uuid',
 *     quantityCases: 5,
 *     toLocationId: 'uuid',
 *   });
 */
const adminTransferStock = wmsOperatorProcedure
  .input(transferStockSchema)
  .mutation(async ({ input, ctx }) => {
    const { stockId, quantityCases, toLocationId, notes } = input;

    // 1. Get the source stock record
    const [sourceStock] = await db
      .select()
      .from(wmsStock)
      .where(eq(wmsStock.id, stockId));

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

    // 6. Update source stock (decrease quantity). Relative to the row as it is
    // now, so a pick or transfer on the same row at the same moment is not
    // overwritten, and refused if those cases have gone meanwhile.
    const [updatedSource] = await db
      .update(wmsStock)
      .set({
        quantityCases: sql`${wmsStock.quantityCases} - ${quantityCases}`,
        availableCases: sql`${wmsStock.availableCases} - ${quantityCases}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(wmsStock.id, stockId),
          gte(wmsStock.availableCases, quantityCases),
        ),
      )
      .returning({ quantityCases: wmsStock.quantityCases });

    if (!updatedSource) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'These cases changed while you were moving them. Scan the bay again and retry.',
      });
    }

    const newSourceQuantity = updatedSource.quantityCases;

    // 7. Check if destination already has this stock (same LWIN, lot, owner)
    const [existingDestStock] = await db
      .select()
      .from(wmsStock)
      .where(
        and(
          eq(wmsStock.locationId, toLocationId),
          eq(wmsStock.lwin18, sourceStock.lwin18),
          eq(wmsStock.ownerId, sourceStock.ownerId),
          sourceStock.lotNumber === null
            ? isNull(wmsStock.lotNumber)
            : eq(wmsStock.lotNumber, sourceStock.lotNumber),
        ),
      );

    let destStockId: string;

    if (existingDestStock) {
      // Update existing stock record
      await db
        .update(wmsStock)
        .set({
          quantityCases: sql`${wmsStock.quantityCases} + ${quantityCases}`,
          availableCases: sql`${wmsStock.availableCases} + ${quantityCases}`,
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
          // Moving wine to another bay does not make it ours to sell.
          notForSale: sourceStock.notForSale,
          consignmentCommissionPercent:
            sourceStock.consignmentCommissionPercent,
          category: sourceStock.category,
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
          sourceStock.lotNumber === null
            ? isNull(wmsCaseLabels.lotNumber)
            : eq(wmsCaseLabels.lotNumber, sourceStock.lotNumber),
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

    // 9. Send open pick lines to the new bay, but only lines picking from this
    // exact stock row (same owner), and only once the row is empty. A transfer
    // moves unreserved cases, so while the row still holds cases the cases held
    // for those lines are still in the old bay.
    if (newSourceQuantity <= 0) {
      const pendingPickItems = await db
        .select({ id: wmsPickListItems.id })
        .from(wmsPickListItems)
        .innerJoin(
          wmsPickLists,
          eq(wmsPickLists.id, wmsPickListItems.pickListId),
        )
        .where(
          and(
            eq(wmsPickListItems.suggestedStockId, stockId),
            eq(wmsPickListItems.isPicked, false),
            inArray(wmsPickLists.status, ['pending', 'in_progress']),
          ),
        );

      if (pendingPickItems.length > 0) {
        await db
          .update(wmsPickListItems)
          .set({
            suggestedLocationId: toLocationId,
            suggestedStockId: destStockId,
            updatedAt: new Date(),
          })
          .where(
            inArray(
              wmsPickListItems.id,
              pendingPickItems.map((item) => item.id),
            ),
          );
      }
    }

    // 10. Create movement record
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
      notes:
        notes ??
        `Transfer from ${fromLocation.locationCode} to ${toLocation.locationCode}`,
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
