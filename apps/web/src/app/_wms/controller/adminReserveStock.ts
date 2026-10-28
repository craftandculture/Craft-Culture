import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsStock } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { reserveStockSchema } from '../schemas/ownershipSchema';

/**
 * Reserve stock for an order
 * Decreases available cases and increases reserved cases
 *
 * @example
 *   await trpcClient.wms.admin.ownership.reserve.mutate({
 *     stockId: "uuid",
 *     quantityCases: 5,
 *     orderId: "uuid",
 *     orderNumber: "PCO-0001"
 *   });
 */
const adminReserveStock = wmsOperatorProcedure
  .input(reserveStockSchema)
  .mutation(async ({ input }) => {
    const { stockId, quantityCases, orderId, orderNumber } = input;

    // Get the stock record
    const [stock] = await db.select().from(wmsStock).where(eq(wmsStock.id, stockId));

    if (!stock) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Stock record not found',
      });
    }

    // Held wine is its owner's, not for an order
    if (stock.notForSale) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${stock.productName} is held for ${stock.ownerName} and not for sale. It cannot be reserved for an order.`,
      });
    }

    // Check available quantity
    if (stock.availableCases < quantityCases) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Insufficient available stock. Available: ${stock.availableCases}, Requested: ${quantityCases}`,
      });
    }

    // Update stock to reserve
    const [updated] = await db
      .update(wmsStock)
      .set({
        reservedCases: sql`${wmsStock.reservedCases} + ${quantityCases}`,
        availableCases: sql`${wmsStock.availableCases} - ${quantityCases}`,
        updatedAt: new Date(),
      })
      // Only if the cases are still free when written, not just when read
      .where(and(eq(wmsStock.id, stockId), sql`${wmsStock.availableCases} >= ${quantityCases}`))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This stock changed a moment ago. Refresh and try again.',
      });
    }

    return {
      success: true,
      stock: updated,
      message: `Reserved ${quantityCases} cases for order ${orderNumber}`,
      orderId,
    };
  });

export default adminReserveStock;
