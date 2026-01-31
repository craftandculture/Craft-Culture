import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { releaseReservationSchema } from '../schemas/ownershipSchema';

/**
 * Release a stock reservation
 * Decreases reserved cases and increases available cases
 *
 * @example
 *   await trpcClient.wms.admin.ownership.release.mutate({
 *     stockId: "uuid",
 *     quantityCases: 5,
 *     reason: "Order cancelled"
 *   });
 */
const adminReleaseReservation = adminProcedure
  .input(releaseReservationSchema)
  .mutation(async ({ input }) => {
    const { stockId, quantityCases, reason } = input;

    // Get the stock record
    const [stock] = await db.select().from(wmsStock).where(eq(wmsStock.id, stockId));

    if (!stock) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Stock record not found',
      });
    }

    // Check reserved quantity
    if (stock.reservedCases < quantityCases) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot release more than reserved. Reserved: ${stock.reservedCases}, Requested: ${quantityCases}`,
      });
    }

    // Update stock to release reservation
    const [updated] = await db
      .update(wmsStock)
      .set({
        reservedCases: sql`${wmsStock.reservedCases} - ${quantityCases}`,
        availableCases: sql`${wmsStock.availableCases} + ${quantityCases}`,
        updatedAt: new Date(),
      })
      .where(eq(wmsStock.id, stockId))
      .returning();

    return {
      success: true,
      stock: updated,
      message: `Released ${quantityCases} cases${reason ? `: ${reason}` : ''}`,
    };
  });

export default adminReleaseReservation;
