import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';

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
 * Build an LWIN18 by replacing the case config portion
 * LWIN-18 format: LWIN11-VINTAGE-CASECONFIG-BOTTLESIZE
 */
const buildLwin18WithConfig = (sourceLwin18: string, newConfig: number) => {
  const parts = sourceLwin18.split('-');
  return `${parts.slice(0, -2).join('-')}-${newConfig.toString().padStart(2, '0')}-${parts[parts.length - 1]}`;
};

/**
 * Strip existing (Nx) suffix from product name before appending a new one
 */
const stripPackSuffix = (name: string) => name.replace(/ \(\d+x\)$/, '');

/**
 * Find or create a stock record at a location for a given LWIN18/owner/lot
 */
const findOrCreateStock = async (
  targetLwin18: string,
  targetProductName: string,
  targetCaseConfig: number,
  targetQuantityCases: number,
  targetLocationId: string,
  sourceStock: {
    ownerId: string;
    ownerName: string | null;
    producer: string | null;
    vintage: number | null;
    bottleSize: string | null;
    lotNumber: string | null;
    receivedAt: Date | null;
    shipmentId: string | null;
    salesArrangement: string | null;
    consignmentCommissionPercent: number | null;
    category: string | null;
    expiryDate: Date | null;
    isPerishable: boolean | null;
  },
) => {
  const [existing] = await db
    .select()
    .from(wmsStock)
    .where(
      and(
        eq(wmsStock.locationId, targetLocationId),
        eq(wmsStock.lwin18, targetLwin18),
        eq(wmsStock.ownerId, sourceStock.ownerId),
        sourceStock.lotNumber === null
          ? isNull(wmsStock.lotNumber)
          : eq(wmsStock.lotNumber, sourceStock.lotNumber),
      ),
    );

  if (existing) {
    await db
      .update(wmsStock)
      .set({
        quantityCases: existing.quantityCases + targetQuantityCases,
        availableCases: existing.availableCases + targetQuantityCases,
        updatedAt: new Date(),
      })
      .where(eq(wmsStock.id, existing.id));
    return existing.id;
  }

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
      category: sourceStock.category,
      expiryDate: sourceStock.expiryDate,
      isPerishable: sourceStock.isPerishable,
    })
    .returning();
  return newStock.id;
};

/**
 * Create case labels for a target LWIN18
 */
const createCaseLabels = async (
  targetLwin18: string,
  targetProductName: string,
  count: number,
  targetLocationId: string,
  lotNumber: string | null,
  shipmentId: string | null,
) => {
  const labels: Array<{ id: string; barcode: string }> = [];
  const existingLabelsCount = await db
    .select({ count: wmsCaseLabels.id })
    .from(wmsCaseLabels)
    .where(eq(wmsCaseLabels.lwin18, targetLwin18));

  let sequence = existingLabelsCount.length + 1;

  for (let i = 0; i < count; i++) {
    const barcode = generateCaseLabelBarcode(targetLwin18, sequence);
    sequence++;

    const [newLabel] = await db
      .insert(wmsCaseLabels)
      .values({
        barcode,
        lwin18: targetLwin18,
        productName: targetProductName,
        lotNumber,
        shipmentId,
        currentLocationId: targetLocationId,
        isActive: true,
      })
      .returning();

    labels.push({ id: newLabel.id, barcode: newLabel.barcode });
  }

  return labels;
};

/**
 * Repack stock from one case configuration to another
 *
 * Supports two modes:
 * - **even**: 1× 12-pack → 2× 6-pack (bottles divide evenly)
 * - **uneven**: 1× 6-pack → 1× 2-pack + 1× 4-pack (remove N bottles)
 */
const adminRepack = adminProcedure
  .input(repackByStockSchema)
  .mutation(async ({ input, ctx }) => {
    const { stockId, sourceQuantityCases, destinationLocationId, notes } = input;

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

    const sourceCaseConfig = sourceStock.caseConfig ?? 12;
    const targetLocationId = destinationLocationId ?? sourceStock.locationId;
    const bottleSize = sourceStock.bottleSize ?? '75cl';
    const baseName = stripPackSuffix(sourceStock.productName);

    if (input.mode === 'even') {
      // ─── EVEN SPLIT ───
      const { targetCaseConfig } = input;
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
      const targetLwin18 = buildLwin18WithConfig(sourceStock.lwin18, targetCaseConfig);
      const repackNumber = await generateRepackNumber();
      const targetProductName = `${baseName} (${targetCaseConfig}x)`;

      // Decrease source stock
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

      // Create or update target stock
      const targetStockId = await findOrCreateStock(
        targetLwin18,
        targetProductName,
        targetCaseConfig,
        targetQuantityCases,
        targetLocationId,
        sourceStock,
      );

      // Deactivate source case labels
      const sourceLabels = await db
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
        .limit(sourceQuantityCases);

      const deactivatedBarcodes: string[] = [];
      for (const label of sourceLabels) {
        await db
          .update(wmsCaseLabels)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(wmsCaseLabels.id, label.id));
        deactivatedBarcodes.push(label.barcode);
      }

      // Create new case labels
      const newCaseLabels = await createCaseLabels(
        targetLwin18,
        targetProductName,
        targetQuantityCases,
        targetLocationId,
        sourceStock.lotNumber,
        sourceStock.shipmentId,
      );

      // Create repack record
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

      // Create movement records
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

      const packSize = `${targetCaseConfig}x${bottleSize}`;

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
          packSize,
          vintage: sourceStock.vintage,
          owner: sourceStock.ownerName,
          lotNumber: sourceStock.lotNumber,
        },
        target2: null as null | {
          lwin18: string;
          productName: string;
          caseConfig: number;
          quantityCases: number;
          stockId: string;
          locationId: string;
          newCaseLabels: Array<{ id: string; barcode: string }>;
          packSize: string;
          vintage: number | null;
          owner: string | null;
          lotNumber: string | null;
        },
      };
    }

    // ─── UNEVEN (CUSTOM) SPLIT ───
    const { bottlesToRemove } = input;

    if (sourceQuantityCases !== 1) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Custom split only supports 1 source case at a time',
      });
    }

    if (bottlesToRemove >= sourceCaseConfig) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot remove ${bottlesToRemove} bottles from a ${sourceCaseConfig}-pack`,
      });
    }

    const removedConfig = bottlesToRemove;
    const remainingConfig = sourceCaseConfig - bottlesToRemove;

    const removedLwin18 = buildLwin18WithConfig(sourceStock.lwin18, removedConfig);
    const remainingLwin18 = buildLwin18WithConfig(sourceStock.lwin18, remainingConfig);

    const removedProductName = `${baseName} (${removedConfig}x)`;
    const remainingProductName = `${baseName} (${remainingConfig}x)`;

    const repackNumber = await generateRepackNumber();

    // Decrease source stock by 1
    const newSourceQuantity = sourceStock.quantityCases - 1;
    const newSourceAvailable = sourceStock.availableCases - 1;

    await db
      .update(wmsStock)
      .set({
        quantityCases: newSourceQuantity,
        availableCases: newSourceAvailable,
        updatedAt: new Date(),
      })
      .where(eq(wmsStock.id, stockId));

    // Create/update stock for removed portion (target 1)
    const removedStockId = await findOrCreateStock(
      removedLwin18,
      removedProductName,
      removedConfig,
      1,
      targetLocationId,
      sourceStock,
    );

    // Create/update stock for remaining portion (target 2)
    const remainingStockId = await findOrCreateStock(
      remainingLwin18,
      remainingProductName,
      remainingConfig,
      1,
      targetLocationId,
      sourceStock,
    );

    // Deactivate 1 source case label
    const sourceLabels = await db
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
      .limit(1);

    const deactivatedBarcodes: string[] = [];
    for (const label of sourceLabels) {
      await db
        .update(wmsCaseLabels)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(wmsCaseLabels.id, label.id));
      deactivatedBarcodes.push(label.barcode);
    }

    // Create case labels for both targets
    const removedLabels = await createCaseLabels(
      removedLwin18,
      removedProductName,
      1,
      targetLocationId,
      sourceStock.lotNumber,
      sourceStock.shipmentId,
    );

    const remainingLabels = await createCaseLabels(
      remainingLwin18,
      remainingProductName,
      1,
      targetLocationId,
      sourceStock.lotNumber,
      sourceStock.shipmentId,
    );

    // Create repack record with both targets
    const [repack] = await db
      .insert(wmsRepacks)
      .values({
        repackNumber,
        sourceLwin18: sourceStock.lwin18,
        sourceProductName: sourceStock.productName,
        sourceCaseConfig,
        sourceQuantityCases: 1,
        sourceStockId: stockId,
        targetLwin18: removedLwin18,
        targetProductName: removedProductName,
        targetCaseConfig: removedConfig,
        targetQuantityCases: 1,
        targetStockId: removedStockId,
        target2Lwin18: remainingLwin18,
        target2ProductName: remainingProductName,
        target2CaseConfig: remainingConfig,
        target2QuantityCases: 1,
        target2StockId: remainingStockId,
        locationId: sourceStock.locationId,
        ownerId: sourceStock.ownerId,
        performedBy: ctx.user.id,
        performedAt: new Date(),
        notes,
      })
      .returning();

    // Create 3 movements: 1 repack_out + 2 repack_in
    const movementNumberOut = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber: movementNumberOut,
      movementType: 'repack_out',
      lwin18: sourceStock.lwin18,
      productName: sourceStock.productName,
      quantityCases: 1,
      fromLocationId: sourceStock.locationId,
      lotNumber: sourceStock.lotNumber,
      scannedBarcodes: deactivatedBarcodes,
      notes: `Custom split to ${removedConfig}-pack + ${remainingConfig}-pack (${repackNumber})`,
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    const movementNumberIn1 = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber: movementNumberIn1,
      movementType: 'repack_in',
      lwin18: removedLwin18,
      productName: removedProductName,
      quantityCases: 1,
      toLocationId: targetLocationId,
      lotNumber: sourceStock.lotNumber,
      scannedBarcodes: removedLabels.map((l) => l.barcode),
      notes: `Custom split from ${sourceCaseConfig}-pack — removed portion (${repackNumber})`,
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    const movementNumberIn2 = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber: movementNumberIn2,
      movementType: 'repack_in',
      lwin18: remainingLwin18,
      productName: remainingProductName,
      quantityCases: 1,
      toLocationId: targetLocationId,
      lotNumber: sourceStock.lotNumber,
      scannedBarcodes: remainingLabels.map((l) => l.barcode),
      notes: `Custom split from ${sourceCaseConfig}-pack — remaining portion (${repackNumber})`,
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    const removedPackSize = `${removedConfig}x${bottleSize}`;
    const remainingPackSize = `${remainingConfig}x${bottleSize}`;

    return {
      success: true,
      repackNumber,
      repackId: repack.id,
      source: {
        lwin18: sourceStock.lwin18,
        productName: sourceStock.productName,
        caseConfig: sourceCaseConfig,
        quantityCases: 1,
        locationId: sourceStock.locationId,
        deactivatedBarcodes,
      },
      target: {
        lwin18: removedLwin18,
        productName: removedProductName,
        caseConfig: removedConfig,
        quantityCases: 1,
        stockId: removedStockId,
        locationId: targetLocationId,
        newCaseLabels: removedLabels,
        packSize: removedPackSize,
        vintage: sourceStock.vintage,
        owner: sourceStock.ownerName,
        lotNumber: sourceStock.lotNumber,
      },
      target2: {
        lwin18: remainingLwin18,
        productName: remainingProductName,
        caseConfig: remainingConfig,
        quantityCases: 1,
        stockId: remainingStockId,
        locationId: targetLocationId,
        newCaseLabels: remainingLabels,
        packSize: remainingPackSize,
        vintage: sourceStock.vintage,
        owner: sourceStock.ownerName,
        lotNumber: sourceStock.lotNumber,
      },
    };
  });

export default adminRepack;
