import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  wmsCycleCountItems,
  wmsCycleCounts,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { reconcileCycleCountSchema } from '../schemas/cycleCountSchema';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Reconcile a completed cycle count by applying approved stock adjustments
 *
 * For each approved item with a discrepancy, adjusts the stock quantity
 * and creates an audit trail movement record.
 *
 * @example
 *   await trpcClient.wms.admin.cycleCounts.reconcile.mutate({
 *     countId: "uuid",
 *     adjustments: [{ itemId: "uuid", approved: true }],
 *   });
 */
const adminReconcileCycleCount = adminProcedure
  .input(reconcileCycleCountSchema)
  .mutation(async ({ input, ctx }) => {
    const { countId, adjustments } = input;

    const [cycleCount] = await db
      .select()
      .from(wmsCycleCounts)
      .where(eq(wmsCycleCounts.id, countId));

    if (!cycleCount) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Cycle count not found',
      });
    }

    if (cycleCount.status !== 'completed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Count must be completed before reconciling',
      });
    }

    // Build a map of item approvals
    const approvalMap = new Map(
      adjustments.map((a) => [a.itemId, a.approved]),
    );

    // Get all items with discrepancies
    const items = await db
      .select()
      .from(wmsCycleCountItems)
      .where(eq(wmsCycleCountItems.cycleCountId, countId));

    let adjustedCount = 0;

    for (const item of items) {
      if (item.discrepancy === null || item.discrepancy === 0) continue;

      const approved = approvalMap.get(item.id);
      if (!approved) continue;

      // Get the stock record
      if (!item.stockId) continue;

      const [stockRecord] = await db
        .select()
        .from(wmsStock)
        .where(eq(wmsStock.id, item.stockId));

      if (!stockRecord) continue;

      const newQuantity = item.countedQuantity ?? 0;
      const oldQuantity = stockRecord.quantityCases;
      const adjustment = newQuantity - oldQuantity;

      if (adjustment === 0) continue;

      // Create audit movement
      const movementNumber = await generateMovementNumber();
      await db.insert(wmsStockMovements).values({
        movementNumber,
        movementType: 'count',
        lwin18: stockRecord.lwin18,
        productName: stockRecord.productName,
        quantityCases: adjustment,
        fromLocationId: adjustment < 0 ? stockRecord.locationId : null,
        toLocationId: adjustment > 0 ? stockRecord.locationId : null,
        notes: `CYCLE COUNT ${cycleCount.countNumber}: was ${oldQuantity}, now ${newQuantity}`,
        reasonCode: 'cycle_count',
        performedBy: ctx.user.id,
        performedAt: new Date(),
      });

      // Update stock
      const newAvailable = Math.max(
        0,
        newQuantity - (stockRecord.reservedCases ?? 0),
      );

      if (newQuantity === 0) {
        await db.delete(wmsStock).where(eq(wmsStock.id, item.stockId));
      } else {
        await db
          .update(wmsStock)
          .set({
            quantityCases: newQuantity,
            availableCases: newAvailable,
            updatedAt: new Date(),
          })
          .where(eq(wmsStock.id, item.stockId));
      }

      adjustedCount++;
    }

    // Mark count as reconciled
    await db
      .update(wmsCycleCounts)
      .set({
        status: 'reconciled',
        updatedAt: new Date(),
      })
      .where(eq(wmsCycleCounts.id, countId));

    return {
      success: true,
      adjustedCount,
      totalItems: items.length,
    };
  });

export default adminReconcileCycleCount;
