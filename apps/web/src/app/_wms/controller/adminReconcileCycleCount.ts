import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  wmsCycleCountItems,
  wmsCycleCounts,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

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
const adminReconcileCycleCount = wmsOperatorProcedure
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

    /*
      One transaction, and the count is claimed first so reconciling twice
      cannot apply the adjustments twice.
    */
    const { adjustedCount, items } = await db.transaction(async (tx) => {
      const claimed = await tx
        .update(wmsCycleCounts)
        .set({
          status: 'reconciled',
          updatedAt: new Date(),
        })
        .where(and(eq(wmsCycleCounts.id, countId), eq(wmsCycleCounts.status, 'completed')))
        .returning({ id: wmsCycleCounts.id });

      if (claimed.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This count has already been reconciled.',
        });
      }

      const items = await tx
        .select()
        .from(wmsCycleCountItems)
        .where(eq(wmsCycleCountItems.cycleCountId, countId));

      let adjustedCount = 0;

      for (const item of items) {
        if (item.discrepancy === null || item.discrepancy === 0) continue;

        const approved = approvalMap.get(item.id);
        if (!approved) continue;

        if (!item.stockId) continue;

        const [stockRecord] = await tx
          .select()
          .from(wmsStock)
          .where(eq(wmsStock.id, item.stockId))
          .for('update');

        if (!stockRecord) continue;

        /*
          Apply what the count found (counted minus expected), not the counted
          figure itself. Setting the row to the count wiped out anything picked
          or received between counting the bay and reconciling it.
        */
        const oldQuantity = stockRecord.quantityCases;
        const newQuantity = Math.max(0, oldQuantity + item.discrepancy);
        const adjustment = newQuantity - oldQuantity;

        if (adjustment === 0) continue;

        const movementNumber = await generateMovementNumber(tx);
        await tx.insert(wmsStockMovements).values({
          movementNumber,
          movementType: 'count',
          lwin18: stockRecord.lwin18,
          productName: stockRecord.productName,
          quantityCases: adjustment,
          fromLocationId: adjustment < 0 ? stockRecord.locationId : null,
          toLocationId: adjustment > 0 ? stockRecord.locationId : null,
          // Whose stock the count changed, as a manual count records it
          fromOwnerId: adjustment < 0 ? stockRecord.ownerId : null,
          stockId: stockRecord.id,
          notes: `CYCLE COUNT ${cycleCount.countNumber}: counted ${item.countedQuantity ?? 0} against ${item.expectedQuantity} expected; row ${oldQuantity} → ${newQuantity}`,
          reasonCode: 'cycle_count',
          performedBy: ctx.user.id,
          performedAt: new Date(),
        });

        await tx
          .update(wmsStock)
          .set({
            quantityCases: newQuantity,
            availableCases: Math.max(0, newQuantity - (stockRecord.reservedCases ?? 0)),
            updatedAt: new Date(),
          })
          .where(eq(wmsStock.id, item.stockId));

        adjustedCount++;
      }

      return { adjustedCount, items };
    });

    return {
      success: true,
      adjustedCount,
      totalItems: items.length,
    };
  });

export default adminReconcileCycleCount;
