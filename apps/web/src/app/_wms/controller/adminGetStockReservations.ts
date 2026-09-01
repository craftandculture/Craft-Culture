import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsStockReservations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Who is holding a reservation on these stock rows
 *
 * Reserved cases were a number with no explanation attached: the stock screens
 * showed how many, and the only endpoint went the other way — order to stock —
 * so answering "why is this reserved?" meant reading the database by hand.
 *
 * The order number is stored on the reservation itself, so this is a lookup
 * rather than a join through two order tables that do not share a shape.
 *
 * @param stockIds - The stock rows on screen
 * @returns Active reservations, oldest first, keyed by stock row
 */
const adminGetStockReservations = adminProcedure
  .input(z.object({ stockIds: z.array(z.string().uuid()).min(1).max(200) }))
  .query(async ({ input }) => {
    const rows = await db
      .select({
        id: wmsStockReservations.id,
        stockId: wmsStockReservations.stockId,
        orderType: wmsStockReservations.orderType,
        orderId: wmsStockReservations.orderId,
        orderNumber: wmsStockReservations.orderNumber,
        quantityCases: wmsStockReservations.quantityCases,
        reservedAt: wmsStockReservations.createdAt,
      })
      .from(wmsStockReservations)
      .where(
        and(
          inArray(wmsStockReservations.stockId, input.stockIds),
          eq(wmsStockReservations.status, 'active'),
        ),
      )
      .orderBy(wmsStockReservations.createdAt);

    const byStock: Record<string, typeof rows> = {};

    for (const row of rows) {
      byStock[row.stockId] = [...(byStock[row.stockId] ?? []), row];
    }

    return { reservations: rows, byStock };
  });

export default adminGetStockReservations;
