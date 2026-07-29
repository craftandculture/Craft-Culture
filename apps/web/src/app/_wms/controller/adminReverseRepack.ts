/**
 * Reverse a repack
 *
 * Undoes a `wms_repacks` record (RPK-xxxx): restores the source pack, removes
 * the split target pack(s), flips the case labels back, writes reversing audit
 * movements, and marks the repack reversed so it can't be undone twice.
 *
 * Guarded: if a target pack has since been picked, moved or reserved (its
 * available cases dropped below what the repack created), the reversal is
 * refused rather than driving stock negative — the operator fixes it manually.
 */

import { TRPCError } from '@trpc/server';
import { eq, inArray, like, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  wmsCaseLabels,
  wmsRepacks,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import generateMovementNumber from '../utils/generateMovementNumber';

const adminReverseRepack = wmsOperatorProcedure
  .input(z.object({ repackNumber: z.string().min(1) }))
  .mutation(async ({ input, ctx }) => {
    const { repackNumber } = input;

    const [repack] = await db
      .select()
      .from(wmsRepacks)
      .where(eq(wmsRepacks.repackNumber, repackNumber));

    if (!repack) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Repack ${repackNumber} not found`,
      });
    }

    if (repack.reversedAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Repack ${repackNumber} has already been reversed`,
      });
    }

    if (!repack.sourceStockId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Repack has no source stock to restore',
      });
    }

    // The pack(s) created by the repack (target + optional target2, for splits).
    const targets = [
      {
        stockId: repack.targetStockId,
        lwin18: repack.targetLwin18,
        productName: repack.targetProductName,
        qty: repack.targetQuantityCases,
        config: repack.targetCaseConfig,
      },
    ];
    if (
      repack.target2StockId &&
      repack.target2Lwin18 &&
      repack.target2ProductName &&
      repack.target2QuantityCases != null &&
      repack.target2CaseConfig != null
    ) {
      targets.push({
        stockId: repack.target2StockId,
        lwin18: repack.target2Lwin18,
        productName: repack.target2ProductName,
        qty: repack.target2QuantityCases,
        config: repack.target2CaseConfig,
      });
    }

    // Guard: every target must still be intact (enough available to remove).
    for (const t of targets) {
      if (!t.stockId) continue;
      const [st] = await db
        .select({ available: wmsStock.availableCases })
        .from(wmsStock)
        .where(eq(wmsStock.id, t.stockId));
      if (!st || st.available < t.qty) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot reverse ${repackNumber} — the ${t.config}-pack has been picked, moved or reserved since. Adjust the stock manually.`,
        });
      }
    }

    // Read the repack's own movements to flip exactly the labels it touched.
    const movements = await db
      .select()
      .from(wmsStockMovements)
      .where(like(wmsStockMovements.notes, `%(${repackNumber})%`));
    const outMove = movements.find((m) => m.movementType === 'repack_out');
    const inMoves = movements.filter((m) => m.movementType === 'repack_in');
    const sourceBarcodes = (outMove?.scannedBarcodes as string[] | null) ?? [];
    const targetBarcodes = inMoves.flatMap(
      (m) => (m.scannedBarcodes as string[] | null) ?? [],
    );

    // Pre-generate movement numbers before the transaction (Neon pool safety).
    const moveNumbers: string[] = [];
    for (let i = 0; i < 1 + targets.length; i++) {
      moveNumbers.push(await generateMovementNumber(i));
    }

    return await db.transaction(async (tx) => {
      // 1. Restore the source pack
      await tx
        .update(wmsStock)
        .set({
          quantityCases: sql`${wmsStock.quantityCases} + ${repack.sourceQuantityCases}`,
          availableCases: sql`${wmsStock.availableCases} + ${repack.sourceQuantityCases}`,
          updatedAt: new Date(),
        })
        .where(eq(wmsStock.id, repack.sourceStockId!));

      // 2. Remove the split target pack(s)
      for (const t of targets) {
        if (!t.stockId) continue;
        await tx
          .update(wmsStock)
          .set({
            quantityCases: sql`${wmsStock.quantityCases} - ${t.qty}`,
            availableCases: sql`${wmsStock.availableCases} - ${t.qty}`,
            updatedAt: new Date(),
          })
          .where(eq(wmsStock.id, t.stockId));
      }

      // 3. Flip the labels back: reactivate source, void targets
      if (sourceBarcodes.length > 0) {
        await tx
          .update(wmsCaseLabels)
          .set({ isActive: true, updatedAt: new Date() })
          .where(inArray(wmsCaseLabels.barcode, sourceBarcodes));
      }
      if (targetBarcodes.length > 0) {
        await tx
          .update(wmsCaseLabels)
          .set({ isActive: false, updatedAt: new Date() })
          .where(inArray(wmsCaseLabels.barcode, targetBarcodes));
      }

      // 4. Reversing audit movements
      await tx.insert(wmsStockMovements).values({
        movementNumber: moveNumbers[0]!,
        movementType: 'adjust',
        lwin18: repack.sourceLwin18,
        productName: repack.sourceProductName,
        quantityCases: repack.sourceQuantityCases,
        toLocationId: repack.locationId,
        notes: `Reversal of ${repackNumber} — restored ${repack.sourceCaseConfig}-pack`,
        reasonCode: 'repack_reversal',
        performedBy: ctx.user.id,
        performedAt: new Date(),
      });
      let idx = 1;
      for (const t of targets) {
        await tx.insert(wmsStockMovements).values({
          movementNumber: moveNumbers[idx]!,
          movementType: 'adjust',
          lwin18: t.lwin18,
          productName: t.productName,
          // Removal → negative. The stock update above subtracts t.qty; the
          // audit movement must match, or the ledger over-counts these packs
          // (reconciliation reads N cases short per reversal).
          quantityCases: -t.qty,
          fromLocationId: repack.locationId,
          notes: `Reversal of ${repackNumber} — removed ${t.config}-pack`,
          reasonCode: 'repack_reversal',
          performedBy: ctx.user.id,
          performedAt: new Date(),
        });
        idx++;
      }

      // 5. Mark the repack reversed
      await tx
        .update(wmsRepacks)
        .set({
          reversedAt: new Date(),
          reversedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(eq(wmsRepacks.id, repack.id));

      return {
        success: true,
        repackNumber,
        message: `Reversed ${repackNumber} — restored the ${repack.sourceCaseConfig}-pack and removed the split pack${targets.length > 1 ? 's' : ''}`,
      };
    });
  });

export default adminReverseRepack;
