import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsStock, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

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
const adminAdjustStockQuantity = adminProcedure
  .input(
    z.object({
      stockId: z.string().uuid(),
      newQuantity: z.number().int().min(0),
      reason: z.string().min(1, 'Reason is required'),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { stockId, newQuantity, reason } = input;

    // Get the stock record
    const [stockRecord] = await db
      .select()
      .from(wmsStock)
      .where(eq(wmsStock.id, stockId));

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
      return {
        success: true,
        noChange: true,
        stockId,
        quantity: newQuantity,
      };
    }

    // Create count movement for audit trail
    const movementNumber = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber,
      movementType: 'count',
      lwin18: stockRecord.lwin18,
      productName: stockRecord.productName,
      quantityCases: adjustment,
      fromLocationId: adjustment < 0 ? stockRecord.locationId : null,
      toLocationId: adjustment > 0 ? stockRecord.locationId : null,
      notes: `CYCLE COUNT: ${reason} (was ${oldQuantity}, now ${newQuantity})`,
      reasonCode: 'cycle_count',
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    // Update the stock record
    const newAvailable = Math.max(0, newQuantity - (stockRecord.reservedCases ?? 0));
    await db
      .update(wmsStock)
      .set({
        quantityCases: newQuantity,
        availableCases: newAvailable,
        updatedAt: new Date(),
      })
      .where(eq(wmsStock.id, stockId));

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
