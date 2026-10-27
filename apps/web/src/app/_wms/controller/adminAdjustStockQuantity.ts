import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsStock, wmsStockMovements } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Adjust stock quantity during cycle counting
 * Creates a 'count' movement for audit trail
 *
 * @example
 *   await trpcClient.wms.admin.stock.adjustQuantity.mutate({
 *     stockId: "uuid",
 *     newQuantity: 5,
 *     reason: "Physical count: found 5 cases, system showed 6"
 *   });
 */
const adminAdjustStockQuantity = wmsOperatorProcedure
  .input(
    z.object({
      stockId: z.string().uuid(),
      newQuantity: z.number().int().min(0),
      reason: z.string().min(1, 'Reason is required'),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { stockId, newQuantity, reason } = input;

    // Read, record and write on a locked row, so two counts cannot interleave
    const outcome = await db.transaction(async (tx) => {
      // Get the stock record
      const [stockRecord] = await tx
        .select()
        .from(wmsStock)
        .where(eq(wmsStock.id, stockId))
        .for('update');

      if (!stockRecord) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Stock record not found',
        });
      }

      const oldQuantity = stockRecord.quantityCases;
      const adjustment = newQuantity - oldQuantity;

      // Skip if no change
      if (adjustment === 0) {
        return { noChange: true as const };
      }

      // Create count movement for audit trail
      const movementNumber = await generateMovementNumber(tx);
      await tx.insert(wmsStockMovements).values({
        movementNumber,
        movementType: 'count',
        lwin18: stockRecord.lwin18,
        productName: stockRecord.productName,
        quantityCases: adjustment,
        fromLocationId: adjustment < 0 ? stockRecord.locationId : null,
        toLocationId: adjustment > 0 ? stockRecord.locationId : null,
        // Whose stock the count changed, so a shortfall shows on their statement (Index 3.0)
        fromOwnerId: adjustment < 0 ? stockRecord.ownerId : null,
        stockId: stockRecord.id,
        notes: `CYCLE COUNT: ${reason} (was ${oldQuantity}, now ${newQuantity})`,
        reasonCode: 'cycle_count',
        performedBy: ctx.user.id,
        performedAt: new Date(),
      });

      // Update the stock record
      const newAvailable = Math.max(0, newQuantity - (stockRecord.reservedCases ?? 0));
      await tx
        .update(wmsStock)
        .set({
          quantityCases: newQuantity,
          availableCases: newAvailable,
          updatedAt: new Date(),
        })
        .where(eq(wmsStock.id, stockId));

      return { noChange: false as const, oldQuantity, adjustment, movementNumber };
    });

    if (outcome.noChange) {
      return {
        success: true,
        noChange: true,
        stockId,
        quantity: newQuantity,
      };
    }

    const { oldQuantity, adjustment, movementNumber } = outcome;

    return {
      success: true,
      noChange: false,
      stockId,
      oldQuantity,
      newQuantity,
      adjustment,
      movementNumber,
    };
  });

export default adminAdjustStockQuantity;
