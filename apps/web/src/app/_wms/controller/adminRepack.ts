import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  wmsCaseLabels,
  wmsRepacks,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { repackByStockSchema } from '../schemas/repackSchema';
import generateCaseLabelBarcode from '../utils/generateCaseLabelBarcode';
import generateMovementNumber from '../utils/generateMovementNumber';
import generateRepackNumber from '../utils/generateRepackNumber';

/**
 * Repack stock from one case configuration to another
 * For example: 1x 12-pack → 2x 6-pack
 *
 * @example
 *   await trpcClient.wms.admin.operations.repack.mutate({
 *     stockId: "uuid",
 *     sourceQuantityCases: 1,
 *     targetCaseConfig: 6
 *   });
 */
const adminRepack = adminProcedure
  .input(repackByStockSchema)
  .mutation(async ({ input, ctx }) => {
    const { stockId, sourceQuantityCases, targetCaseConfig, destinationLocationId, notes } = input;

    // 1. Get the source stock record
    const [sourceStock] = await db.select().from(wmsStock).where(eq(wmsStock.id, stockId));

    if (!sourceStock) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Stock record not found',
      });
    }

    // 2. Validate quantity
    if (sourceQuantityCases > sourceStock.availableCases) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Only ${sourceStock.availableCases} cases available to repack`,
      });
    }

    // 3. Validate repack is valid (must create valid number of target cases)
    const sourceCaseConfig = sourceStock.caseConfig ?? 12;
    const totalBottles = sourceQuantityCases * sourceCaseConfig;

    if (totalBottles % targetCaseConfig !== 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot evenly divide ${totalBottles} bottles into ${targetCaseConfig}-packs`,
      });
    }

    if (targetCaseConfig >= sourceCaseConfig) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Target case config must be smaller than source',
      });
    }

    const targetQuantityCases = totalBottles / targetCaseConfig;

    // Determine destination location (use provided or default to source)
    const targetLocationId = destinationLocationId ?? sourceStock.locationId;

    // 4. Generate new LWIN-18 for target (change case config portion)
    // LWIN-18 format: LWIN11-VINTAGE-CASECONFIG-BOTTLESIZE
    const sourceLwin18Parts = sourceStock.lwin18.split('-');
    const targetLwin18 = `${sourceLwin18Parts.slice(0, -2).join('-')}-${targetCaseConfig.toString().padStart(2, '0')}-${sourceLwin18Parts[sourceLwin18Parts.length - 1]}`;

    // 5. Generate repack number
    const repackNumber = await generateRepackNumber();

    // 6. Decrease source stock
    // Note: Don't delete even if quantity is 0 - wms_repacks has FK reference to source_stock_id
    const newSourceQuantity = sourceStock.quantityCases - sourceQuantityCases;
    const newSourceAvailable = sourceStock.availableCases - sourceQuantityCases;

    await db
      .update(wmsStock)
      .set({
        quantityCases: newSourceQuantity,
        availableCases: newSourceAvailable,
        updatedAt: new Date(),
      })
      .where(eq(wmsStock.id, stockId));

    // 7. Create or update target stock at destination location
    const [existingTargetStock] = await db
      .select()
      .from(wmsStock)
      .where(
        and(
          eq(wmsStock.locationId, targetLocationId),
          eq(wmsStock.lwin18, targetLwin18),
          eq(wmsStock.ownerId, sourceStock.ownerId),
          eq(wmsStock.lotNumber, sourceStock.lotNumber ?? ''),
        ),
      );

    let targetStockId: string;
    const targetProductName = `${sourceStock.productName} (${targetCaseConfig}x)`;

    if (existingTargetStock) {
      await db
        .update(wmsStock)
        .set({
          quantityCases: existingTargetStock.quantityCases + targetQuantityCases,
          availableCases: existingTargetStock.availableCases + targetQuantityCases,
          updatedAt: new Date(),
        })
        .where(eq(wmsStock.id, existingTargetStock.id));
      targetStockId = existingTargetStock.id;
    } else {
      const [newStock] = await db
        .insert(wmsStock)
        .values({
          locationId: targetLocationId,
          ownerId: sourceStock.ownerId,
          ownerName: sourceStock.ownerName,
          lwin18: targetLwin18,
          productName: targetProductName,
          producer: sourceStock.producer,
          vintage: sourceStock.vintage,
          bottleSize: sourceStock.bottleSize,
          caseConfig: targetCaseConfig,
          quantityCases: targetQuantityCases,
          reservedCases: 0,
          availableCases: targetQuantityCases,
          lotNumber: sourceStock.lotNumber,
          receivedAt: sourceStock.receivedAt,
          shipmentId: sourceStock.shipmentId,
          salesArrangement: sourceStock.salesArrangement,
          consignmentCommissionPercent: sourceStock.consignmentCommissionPercent,
          expiryDate: sourceStock.expiryDate,
          isPerishable: sourceStock.isPerishable,
        })
        .returning();
      targetStockId = newStock.id;
    }

    // 8. Deactivate source case labels
    const sourceLabels = await db
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
      .limit(sourceQuantityCases);

    const deactivatedBarcodes: string[] = [];
    for (const label of sourceLabels) {
      await db
        .update(wmsCaseLabels)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(wmsCaseLabels.id, label.id));
      deactivatedBarcodes.push(label.barcode);
    }

    // 9. Create new case labels for target cases
    const newCaseLabels: Array<{ id: string; barcode: string }> = [];
    const existingLabelsCount = await db
      .select({ count: wmsCaseLabels.id })
      .from(wmsCaseLabels)
      .where(eq(wmsCaseLabels.lwin18, targetLwin18));

    let sequence = existingLabelsCount.length + 1;

    for (let i = 0; i < targetQuantityCases; i++) {
      const barcode = generateCaseLabelBarcode(targetLwin18, sequence);
      sequence++;

      const [newLabel] = await db
        .insert(wmsCaseLabels)
        .values({
          barcode,
          lwin18: targetLwin18,
          productName: targetProductName,
          lotNumber: sourceStock.lotNumber,
          shipmentId: sourceStock.shipmentId,
          currentLocationId: targetLocationId,
          isActive: true,
        })
        .returning();

      newCaseLabels.push({ id: newLabel.id, barcode: newLabel.barcode });
    }

    // 10. Create repack record
    const [repack] = await db
      .insert(wmsRepacks)
      .values({
        repackNumber,
        sourceLwin18: sourceStock.lwin18,
        sourceProductName: sourceStock.productName,
        sourceCaseConfig,
        sourceQuantityCases,
        sourceStockId: stockId,
        targetLwin18,
        targetProductName,
        targetCaseConfig,
        targetQuantityCases,
        targetStockId,
        locationId: sourceStock.locationId,
        ownerId: sourceStock.ownerId,
        performedBy: ctx.user.id,
        performedAt: new Date(),
        notes,
      })
      .returning();

    // 11. Create movement records (repack_out and repack_in)
    const movementNumberOut = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber: movementNumberOut,
      movementType: 'repack_out',
      lwin18: sourceStock.lwin18,
      productName: sourceStock.productName,
      quantityCases: sourceQuantityCases,
      fromLocationId: sourceStock.locationId,
      lotNumber: sourceStock.lotNumber,
      scannedBarcodes: deactivatedBarcodes,
      notes: `Repacked to ${targetCaseConfig}-pack (${repackNumber})`,
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    const movementNumberIn = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber: movementNumberIn,
      movementType: 'repack_in',
      lwin18: targetLwin18,
      productName: targetProductName,
      quantityCases: targetQuantityCases,
      toLocationId: targetLocationId,
      lotNumber: sourceStock.lotNumber,
      scannedBarcodes: newCaseLabels.map((l) => l.barcode),
      notes: `Repacked from ${sourceCaseConfig}-pack (${repackNumber})`,
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    // Calculate pack size for labels (e.g., "6x750ml")
    const bottleSize = sourceStock.bottleSize ?? 750;
    const packSize = `${targetCaseConfig}x${bottleSize}ml`;

    return {
      success: true,
      repackNumber,
      repackId: repack.id,
      source: {
        lwin18: sourceStock.lwin18,
        productName: sourceStock.productName,
        caseConfig: sourceCaseConfig,
        quantityCases: sourceQuantityCases,
        locationId: sourceStock.locationId,
        deactivatedBarcodes,
      },
      target: {
        lwin18: targetLwin18,
        productName: targetProductName,
        caseConfig: targetCaseConfig,
        quantityCases: targetQuantityCases,
        stockId: targetStockId,
        locationId: targetLocationId,
        newCaseLabels,
        // Additional data for label generation
        packSize,
        vintage: sourceStock.vintage,
        owner: sourceStock.ownerName,
        lotNumber: sourceStock.lotNumber,
      },
    };
  });

export default adminRepack;
