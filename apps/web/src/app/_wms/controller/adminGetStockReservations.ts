import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrders, wmsStockReservations, zohoDraftHolds, zohoSalesOrders } from '@/database/schema';
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

    // Who each hold is for, from whichever kind of order holds it
    const idsOf = (type: string) => rows.filter((r) => r.orderType === type).map((r) => r.orderId);
    const [zohoNames, pcoNames, draftNames] = await Promise.all([
      idsOf('zoho').length
        ? db.select({ id: zohoSalesOrders.id, name: zohoSalesOrders.customerName }).from(zohoSalesOrders).where(inArray(zohoSalesOrders.id, idsOf('zoho')))
        : [],
      idsOf('pco').length
        ? db.select({ id: privateClientOrders.id, name: privateClientOrders.clientName }).from(privateClientOrders).where(inArray(privateClientOrders.id, idsOf('pco')))
        : [],
      idsOf('zoho_draft').length
        ? db.select({ id: zohoDraftHolds.id, name: zohoDraftHolds.customerName }).from(zohoDraftHolds).where(inArray(zohoDraftHolds.id, idsOf('zoho_draft')))
        : [],
    ]);
    const nameOf = new Map([...zohoNames, ...pcoNames, ...draftNames].map((r) => [r.id, r.name]));
    const named = rows.map((r) => ({ ...r, clientName: nameOf.get(r.orderId) ?? null }));

    const byStock: Record<string, typeof named> = {};

    for (const row of named) {
      byStock[row.stockId] = [...(byStock[row.stockId] ?? []), row];
    }

    return { reservations: named, byStock };
  });

export default adminGetStockReservations;
