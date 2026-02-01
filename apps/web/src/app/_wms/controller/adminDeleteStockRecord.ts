import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsStock, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Delete a stock record with audit trail
 * Creates an adjustment movement to track the deletion
 *
 * @example
 *   await trpcClient.wms.admin.stock.deleteRecord.mutate({
 *     stockId: "uuid",
 *     reason: "Duplicate record from receiving retry"
 *   });
 */
const adminDeleteStockRecord = adminProcedure
  .input(
    z.object({
      stockId: z.string().uuid(),
      reason: z.string().min(1, 'Reason is required'),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { stockId, reason } = input;

    // Get the stock record first
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

    // Create adjustment movement for audit trail
    const movementNumber = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber,
      movementType: 'adjust',
      lwin18: stockRecord.lwin18,
      productName: stockRecord.productName,
      quantityCases: -stockRecord.quantityCases, // Negative for removal
      fromLocationId: stockRecord.locationId,
      notes: `DELETED: ${reason}`,
      reasonCode: 'stock_correction',
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    // Delete the stock record
    await db.delete(wmsStock).where(eq(wmsStock.id, stockId));

    return {
      success: true,
      deleted: {
        id: stockRecord.id,
        lwin18: stockRecord.lwin18,
        productName: stockRecord.productName,
        quantityCases: stockRecord.quantityCases,
      },
      movementNumber,
    };
  });

export default adminDeleteStockRecord;
