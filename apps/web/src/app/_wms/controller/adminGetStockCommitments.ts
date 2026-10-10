import { and, eq, inArray, isNull, like, ne, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  privateClientOrderItems,
  privateClientOrders,
  wmsStock,
  wmsStockReservations,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import inOurWarehouse from '../utils/inOurWarehouse';
import lwinPackAgnosticPattern from '../utils/lwinPackAgnosticPattern';
import normalizeLwin18 from '../utils/normalizeLwin18';

/*
  A PCO commits its wine from submission until it becomes a Zoho order (which
  then holds the stock itself) or the wine has left. Drafts are not yet an
  order; these are finished or gone.
*/
const NOT_COMMITTING = ['draft', 'cancelled', 'delivered', 'stock_in_transit', 'with_distributor', 'out_for_delivery'] as const;

/**
 * What a wine has on hand, who it is promised to, and what is actually free
 *
 * Shown where an order is entered, so a second order cannot take wine the
 * first one already has. Counted in bottles across every pack of the wine
 * (a 3-pack and a 6-pack of the same vintage and size are the same wine):
 *
 * - On hand: sealed cases and loose bottles in our warehouse, not held for
 *   their owner.
 * - Held: active holds, each with its order number and client.
 * - Promised: submitted PCOs not yet on a Zoho order, which hold nothing.
 * - Free: on hand, less held, less promised.
 *
 * @example
 *   await trpcClient.wms.admin.ownership.getCommitments.query({ lwin18: '1012781-2015-06-00750' });
 */
const adminGetStockCommitments = adminProcedure
  .input(
    z.object({
      lwin18: z.string().min(7).max(40),
      /** The order being edited, whose own lines are not a competing claim */
      excludePcoId: z.string().uuid().optional(),
    }),
  )
  .query(async ({ input }) => {
    const code = normalizeLwin18(input.lwin18.trim());
    const pattern = lwinPackAgnosticPattern(code);

    if (!pattern) {
      return { recognised: false as const, onHandBottles: 0, heldBottles: 0, promisedBottles: 0, freeBottles: 0, holds: [], promised: [] };
    }

    const [stockRows, holdRows, pcoRows] = await Promise.all([
      db
        .select({
          bottles: sql<number>`coalesce(sum(${wmsStock.quantityCases} * coalesce(${wmsStock.caseConfig}, 1) + ${wmsStock.openBottles}), 0)::int`,
        })
        .from(wmsStock)
        .where(and(like(wmsStock.lwin18, pattern), eq(wmsStock.notForSale, false), inOurWarehouse())),
      db
        .select({
          orderType: wmsStockReservations.orderType,
          orderId: wmsStockReservations.orderId,
          orderNumber: wmsStockReservations.orderNumber,
          bottles: sql<number>`sum(${wmsStockReservations.quantityCases} * coalesce(${wmsStock.caseConfig}, 1))::int`,
        })
        .from(wmsStockReservations)
        .innerJoin(wmsStock, eq(wmsStock.id, wmsStockReservations.stockId))
        .where(and(eq(wmsStockReservations.status, 'active'), like(wmsStock.lwin18, pattern)))
        .groupBy(wmsStockReservations.orderType, wmsStockReservations.orderId, wmsStockReservations.orderNumber),
      // Narrowed on the LWIN7 here; the exact wine, vintage and size are checked below,
      // because PCO lines can carry the code with or without dashes
      db
        .select({
          orderId: privateClientOrders.id,
          orderNumber: privateClientOrders.orderNumber,
          clientName: privateClientOrders.clientName,
          status: privateClientOrders.status,
          lwin: privateClientOrderItems.lwin,
          quantity: privateClientOrderItems.quantity,
          caseConfig: privateClientOrderItems.caseConfig,
        })
        .from(privateClientOrderItems)
        .innerJoin(privateClientOrders, eq(privateClientOrders.id, privateClientOrderItems.orderId))
        .where(
          and(
            like(privateClientOrderItems.lwin, `${code.slice(0, 7)}%`),
            notInArray(privateClientOrders.status, [...NOT_COMMITTING]),
            isNull(privateClientOrders.zohoSalesOrderId),
            ...(input.excludePcoId ? [ne(privateClientOrders.id, input.excludePcoId)] : []),
          ),
        ),
    ]);

    // Client names for the holds, from whichever kind of order holds them
    const zohoIds = holdRows.filter((h) => h.orderType === 'zoho').map((h) => h.orderId);
    const pcoIds = holdRows.filter((h) => h.orderType === 'pco').map((h) => h.orderId);
    const [zohoNames, pcoNames] = await Promise.all([
      zohoIds.length
        ? db
            .select({ id: zohoSalesOrders.id, name: zohoSalesOrders.customerName })
            .from(zohoSalesOrders)
            .where(inArray(zohoSalesOrders.id, zohoIds))
        : [],
      pcoIds.length
        ? db
            .select({ id: privateClientOrders.id, name: privateClientOrders.clientName })
            .from(privateClientOrders)
            .where(inArray(privateClientOrders.id, pcoIds))
        : [],
    ]);
    const nameOf = new Map([...zohoNames, ...pcoNames].map((r) => [r.id, r.name]));

    const sameWine = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('%', '\\d{2}')}$`);
    const promisedByOrder = new Map<string, { orderNumber: string; clientName: string; bottles: number }>();
    for (const row of pcoRows) {
      if (!row.lwin || !sameWine.test(normalizeLwin18(row.lwin))) continue;
      const entry = promisedByOrder.get(row.orderId) ?? { orderNumber: row.orderNumber, clientName: row.clientName, bottles: 0 };
      entry.bottles += row.quantity * (row.caseConfig ?? 1);
      promisedByOrder.set(row.orderId, entry);
    }

    const holds = holdRows
      .map((h) => ({ orderNumber: h.orderNumber, clientName: nameOf.get(h.orderId) ?? null, kind: h.orderType, bottles: h.bottles }))
      .sort((a, b) => b.bottles - a.bottles);
    const promised = [...promisedByOrder.values()].sort((a, b) => b.bottles - a.bottles);

    const onHandBottles = stockRows[0]?.bottles ?? 0;
    const heldBottles = holds.reduce((s, h) => s + h.bottles, 0);
    const promisedBottles = promised.reduce((s, p) => s + p.bottles, 0);

    return {
      recognised: true as const,
      onHandBottles,
      heldBottles,
      promisedBottles,
      freeBottles: Math.max(0, onHandBottles - heldBottles - promisedBottles),
      holds,
      promised,
    };
  });

export default adminGetStockCommitments;
