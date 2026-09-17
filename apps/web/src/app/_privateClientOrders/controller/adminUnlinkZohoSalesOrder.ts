import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Forget the Zoho sales order this private client order raised
 *
 * Raising one writes its id here so a second press cannot raise a duplicate.
 * That guard has no counterpart: a sales order deleted or voided in Zoho left
 * the PCO permanently pointing at a document that no longer exists, refusing to
 * raise another, and only reachable with a hand on the database.
 *
 * It clears our record and touches nothing in Zoho. Deleting the sales order
 * there is a separate, deliberate act — doing it from here would turn an
 * "actually, raise that again" into the silent destruction of a document the
 * accounts may already have acted on.
 *
 * @example
 *   await trpcClient.privateClientOrders.adminUnlinkZohoSalesOrder.mutate({
 *     orderId,
 *   });
 */
const adminUnlinkZohoSalesOrder = adminProcedure
  .input(z.object({ orderId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const [order] = await db
      .select({
        id: privateClientOrders.id,
        orderNumber: privateClientOrders.orderNumber,
        salesOrderId: privateClientOrders.zohoSalesOrderId,
        salesOrderNumber: privateClientOrders.zohoSalesOrderNumber,
      })
      .from(privateClientOrders)
      .where(eq(privateClientOrders.id, input.orderId));

    if (!order) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    if (!order.salesOrderId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This order has no sales order linked.',
      });
    }

    await db
      .update(privateClientOrders)
      .set({
        zohoSalesOrderId: null,
        zohoSalesOrderNumber: null,
        zohoSalesOrderCreatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(privateClientOrders.id, input.orderId));

    logger.info('[PCO] Zoho sales order unlinked', {
      orderNumber: order.orderNumber,
      salesOrderId: order.salesOrderId,
      salesOrderNumber: order.salesOrderNumber,
    });

    return {
      unlinked: order.salesOrderNumber ?? order.salesOrderId,
      /*
        Said plainly, because the number is still live in Zoho and the next
        press will make a second one alongside it.
      */
      stillInZoho: true,
    };
  });

export default adminUnlinkZohoSalesOrder;
