import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsCaseLabels, wmsStock, wmsStockMovements } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import generateCaseLabelBarcode from '../utils/generateCaseLabelBarcode';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Rebuild an LWIN18 with a different case config. LWIN-18 format:
 * LWIN11-VINTAGE-CASECONFIG-BOTTLESIZE
 */
const buildLwin18WithConfig = (sourceLwin18: string, newConfig: number) => {
  const parts = sourceLwin18.split('-');
  return `${parts.slice(0, -2).join('-')}-${newConfig.toString().padStart(2, '0')}-${parts[parts.length - 1]}`;
};

/** Swap any existing "(Nx)" / "(N Pack)" suffix for the corrected pack size. */
const withPackSuffix = (name: string, config: number) => {
  const base = name.replace(/ \(\d+x\)$/, '').replace(/ \(\d+ Pack\)$/, '');
  return base === name ? name : `${base} (${config}x)`;
};

/**
 * Correct a stock line's case config when the pack size was recorded wrongly.
 *
 * This is NOT a repack. A repack physically moves bottles between cases and so
 * conserves the bottle count (18×6 becomes 36×3). Here nothing is touched in
 * the warehouse — the same physical cases were only ever mis-described, so the
 * CASE count is preserved and the bottle count moves with the corrected pack
 * (18 cases recorded as 6-packs but actually 3-packs: 108 bottles → 54).
 *
 * Because the pack size is encoded in the LWIN18, correcting it re-keys the
 * stock onto the right SKU, merging into an existing line if one already sits
 * at that location for the same owner and lot. Case labels carry the LWIN18 in
 * their barcode, so the old ones are deactivated and reissued.
 *
 * @example
 *   await trpcClient.wms.admin.stock.correctPackConfig.mutate({
 *     stockId: 'uuid',
 *     newCaseConfig: 3,
 *     reason: 'Received as 6-pack, physically 3-pack',
 *   });
 */
const adminCorrectPackConfig = wmsOperatorProcedure
  .input(
    z.object({
      stockId: z.string().uuid(),
      newCaseConfig: z.number().int().positive('Pack size must be positive'),
      reason: z.string().min(1, 'Reason is required'),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { stockId, newCaseConfig, reason } = input;

    const [stock] = await db
      .select()
      .from(wmsStock)
      .where(eq(wmsStock.id, stockId));

    if (!stock) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Stock record not found',
      });
    }

    // Falling back to zero made the audit note read "bottles 0 -> 72", which
    // reads as stock having appeared from nowhere. An unset pack is unknown,
    // not none.
    const oldCaseConfig = stock.caseConfig ?? null;
    if (oldCaseConfig === newCaseConfig) {
      return {
        success: true,
        noChange: true,
        stockId,
        caseConfig: newCaseConfig,
      };
    }

    const newLwin18 = buildLwin18WithConfig(stock.lwin18, newCaseConfig);
    const newProductName = withPackSuffix(stock.productName, newCaseConfig);
    const cases = stock.quantityCases;
    const oldBottles = oldCaseConfig === null ? null : cases * oldCaseConfig;
    const newBottles = cases * newCaseConfig;

    // Generated before the transaction: on Neon serverless, running the number
    // generator inside one can deadlock the connection pool (same as repack).
    const movementNumber = await generateMovementNumber();

    const result = await db.transaction(async (tx) => {
      // Merge into an existing line for the corrected SKU at this location,
      // rather than leaving two rows for the same physical shelf position.
      const [existing] = await tx
        .select()
        .from(wmsStock)
        .where(
          and(
            eq(wmsStock.locationId, stock.locationId),
            eq(wmsStock.lwin18, newLwin18),
            eq(wmsStock.ownerId, stock.ownerId),
            stock.lotNumber === null
              ? isNull(wmsStock.lotNumber)
              : eq(wmsStock.lotNumber, stock.lotNumber),
          ),
        );

      let targetStockId = stockId;

      if (existing && existing.id !== stockId) {
        await tx
          .update(wmsStock)
          .set({
            quantityCases: existing.quantityCases + cases,
            availableCases: existing.availableCases + stock.availableCases,
            reservedCases:
              (existing.reservedCases ?? 0) + (stock.reservedCases ?? 0),
            updatedAt: new Date(),
          })
          .where(eq(wmsStock.id, existing.id));
        await tx.delete(wmsStock).where(eq(wmsStock.id, stockId));
        targetStockId = existing.id;
      } else {
        await tx
          .update(wmsStock)
          .set({
            lwin18: newLwin18,
            productName: newProductName,
            caseConfig: newCaseConfig,
            updatedAt: new Date(),
          })
          .where(eq(wmsStock.id, stockId));
      }

      // Case-label barcodes embed the LWIN18, so the old ones no longer
      // describe what is on the shelf. Retire them and reissue.
      const oldLabels = await tx
        .select()
        .from(wmsCaseLabels)
        .where(
          and(
            eq(wmsCaseLabels.currentLocationId, stock.locationId),
            eq(wmsCaseLabels.lwin18, stock.lwin18),
            stock.lotNumber === null
              ? isNull(wmsCaseLabels.lotNumber)
              : eq(wmsCaseLabels.lotNumber, stock.lotNumber),
            eq(wmsCaseLabels.isActive, true),
          ),
        )
        .limit(cases);

      for (const label of oldLabels) {
        await tx
          .update(wmsCaseLabels)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(wmsCaseLabels.id, label.id));
      }

      const existingForTarget = await tx
        .select({ id: wmsCaseLabels.id })
        .from(wmsCaseLabels)
        .where(eq(wmsCaseLabels.lwin18, newLwin18));
      let sequence = existingForTarget.length + 1;

      const newBarcodes: string[] = [];
      for (let i = 0; i < oldLabels.length; i++) {
        const barcode = generateCaseLabelBarcode(newLwin18, sequence);
        sequence++;
        await tx.insert(wmsCaseLabels).values({
          barcode,
          lwin18: newLwin18,
          productName: newProductName,
          currentLocationId: stock.locationId,
          lotNumber: stock.lotNumber,
          shipmentId: stock.shipmentId,
          isActive: true,
        });
        newBarcodes.push(barcode);
      }

      await tx.insert(wmsStockMovements).values({
        movementNumber,
        movementType: 'adjust',
        lwin18: newLwin18,
        productName: newProductName,
        quantityCases: 0, // cases unchanged — only the pack size was wrong
        fromLocationId: stock.locationId,
        toLocationId: stock.locationId,
        notes: `PACK CORRECTION: ${reason} (${stock.lwin18} ${oldCaseConfig ?? 'unset'}-pack → ${newLwin18} ${newCaseConfig}-pack; ${cases} cases unchanged, bottles ${oldBottles ?? 'unknown'} → ${newBottles})`,
        reasonCode: 'pack_correction',
        performedBy: ctx.user.id,
        performedAt: new Date(),
      });

      return { targetStockId, relabelled: newBarcodes.length };
    });

    return {
      success: true,
      stockId: result.targetStockId,
      mergedInto:
        result.targetStockId !== stockId ? result.targetStockId : null,
      lwin18: newLwin18,
      productName: newProductName,
      caseConfig: newCaseConfig,
      cases,
      bottlesBefore: oldBottles,
      bottlesAfter: newBottles,
      relabelled: result.relabelled,
    };
  });

export default adminCorrectPackConfig;
