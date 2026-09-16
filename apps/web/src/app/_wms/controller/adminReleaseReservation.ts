import { TRPCError } from '@trpc/server';
import { and, asc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsStock, wmsStockReservations } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

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
const adminReleaseReservation = wmsOperatorProcedure
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

    const now = new Date();

    // Update stock to release reservation
    const [updated] = await db
      .update(wmsStock)
      .set({
        reservedCases: sql`${wmsStock.reservedCases} - ${quantityCases}`,
        availableCases: sql`${wmsStock.availableCases} + ${quantityCases}`,
        updatedAt: now,
      })
      .where(eq(wmsStock.id, stockId))
      .returning();

    /*
     * Close the reservation rows too, oldest first, up to the quantity handed
     * back. Without this the row stays 'active' while the stock says released,
     * and the next order-level release (adminUpdateStatus, reconcile) hands the
     * same cases back a second time — inflating availableCases above what is
     * physically on the shelf.
     */
    const active = await db
      .select({
        id: wmsStockReservations.id,
        quantityCases: wmsStockReservations.quantityCases,
      })
      .from(wmsStockReservations)
      .where(
        and(
          eq(wmsStockReservations.stockId, stockId),
          eq(wmsStockReservations.status, 'active'),
        ),
      )
      .orderBy(asc(wmsStockReservations.createdAt));

    let remaining = quantityCases;
    let closed = 0;

    for (const reservation of active) {
      if (remaining < reservation.quantityCases) break;
      await db
        .update(wmsStockReservations)
        .set({
          status: 'released' as const,
          releasedAt: now,
          releaseReason: reason ?? 'Released from Stock Explorer',
          updatedAt: now,
        })
        .where(eq(wmsStockReservations.id, reservation.id));
      remaining -= reservation.quantityCases;
      closed++;
    }

    return {
      success: true,
      stock: updated,
      reservationsClosed: closed,
      message: `Released ${quantityCases} case${quantityCases === 1 ? '' : 's'}${reason ? `: ${reason}` : ''}`,
    };
  });

export default adminReleaseReservation;
