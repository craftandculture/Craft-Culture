import { TRPCError } from '@trpc/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrders, zohoSalesOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Link a Zoho sales order raised by hand to the PCO it fulfils
 *
 * The sync links an order that quotes the PCO number in Reference. This is
 * for the one it could not: no reference, or a mistyped one. Refuses to move
 * an order already linked to a different PCO, or to give a PCO a second SO
 * when it already has one, so a slip cannot silently re-route a delivery.
 *
 * @example
 *   await trpcClient.zohoSalesOrders.linkToPco.mutate({
 *     pcoId,
 *     salesOrderNumber: 'SO-00225',
 *   });
 */
const adminLinkSalesOrderToPco = adminProcedure
  .input(
    z.object({
      pcoId: z.string().uuid(),
      salesOrderNumber: z.string().trim().min(3).max(40),
    }),
  )
  .mutation(async ({ input }) => {
    const number = input.salesOrderNumber.toUpperCase();

    const [pco] = await db
      .select({
        id: privateClientOrders.id,
        orderNumber: privateClientOrders.orderNumber,
        zohoSalesOrderId: privateClientOrders.zohoSalesOrderId,
      })
      .from(privateClientOrders)
      .where(eq(privateClientOrders.id, input.pcoId));
    if (!pco) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    const [salesOrder] = await db
      .select({
        id: zohoSalesOrders.id,
        zohoSalesOrderId: zohoSalesOrders.zohoSalesOrderId,
        pcoId: zohoSalesOrders.privateClientOrderId,
      })
      .from(zohoSalesOrders)
      .where(eq(zohoSalesOrders.salesOrderNumber, number));
    if (!salesOrder) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `${number} is not in the Index yet. Press Sync from Zoho, then try again.`,
      });
    }

    if (salesOrder.pcoId && salesOrder.pcoId !== pco.id) {
      const [other] = await db
        .select({ orderNumber: privateClientOrders.orderNumber })
        .from(privateClientOrders)
        .where(eq(privateClientOrders.id, salesOrder.pcoId));
      throw new TRPCError({
        code: 'CONFLICT',
        message: `${number} is already linked to ${other?.orderNumber ?? 'another order'}.`,
      });
    }

    const [otherSo] = await db
      .select({ number: zohoSalesOrders.salesOrderNumber })
      .from(zohoSalesOrders)
      .where(
        and(
          eq(zohoSalesOrders.privateClientOrderId, pco.id),
          ne(zohoSalesOrders.id, salesOrder.id),
        ),
      );
    if (
      otherSo ||
      (pco.zohoSalesOrderId && pco.zohoSalesOrderId !== salesOrder.zohoSalesOrderId)
    ) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `${pco.orderNumber} already has a sales order${otherSo ? ` (${otherSo.number})` : ''}.`,
      });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(zohoSalesOrders)
        .set({ privateClientOrderId: pco.id })
        .where(eq(zohoSalesOrders.id, salesOrder.id));
      await tx
        .update(privateClientOrders)
        .set({ zohoSalesOrderId: salesOrder.zohoSalesOrderId })
        .where(eq(privateClientOrders.id, pco.id));
    });

    return { pcoNumber: pco.orderNumber, salesOrderNumber: number };
  });

export default adminLinkSalesOrderToPco;
