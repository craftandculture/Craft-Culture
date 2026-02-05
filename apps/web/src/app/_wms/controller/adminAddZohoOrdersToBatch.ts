import { TRPCError } from '@trpc/server';
import { eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  wmsDispatchBatchOrders,
  wmsDispatchBatches,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Add Zoho Sales Orders to a dispatch batch
 *
 * Updates the dispatchBatchId on the Zoho orders and recalculates batch totals.
 *
 * @example
 *   await trpcClient.wms.admin.dispatch.addZohoOrders.mutate({
 *     batchId: "uuid",
 *     orderIds: ["zoho-order-uuid-1", "zoho-order-uuid-2"]
 *   });
 */
const adminAddZohoOrdersToBatch = adminProcedure
  .input(
    z.object({
      batchId: z.string().uuid(),
      orderIds: z.array(z.string().uuid()).min(1),
    }),
  )
  .mutation(async ({ input }) => {
    const { batchId, orderIds } = input;

    // Get batch
    const [batch] = await db
      .select()
      .from(wmsDispatchBatches)
      .where(eq(wmsDispatchBatches.id, batchId));

    if (!batch) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dispatch batch not found',
      });
    }

    if (batch.status === 'dispatched' || batch.status === 'delivered') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot add orders to a ${batch.status} batch`,
      });
    }

    // Get Zoho orders
    const orders = await db
      .select({
        id: zohoSalesOrders.id,
        salesOrderNumber: zohoSalesOrders.salesOrderNumber,
        dispatchBatchId: zohoSalesOrders.dispatchBatchId,
      })
      .from(zohoSalesOrders)
      .where(inArray(zohoSalesOrders.id, orderIds));

    if (orders.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No Zoho orders found',
      });
    }

    // Filter to only orders not already in a batch
    const availableOrders = orders.filter((o) => !o.dispatchBatchId);

    if (availableOrders.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'All orders are already assigned to a batch',
      });
    }

    // Update orders to link to batch
    await db
      .update(zohoSalesOrders)
      .set({
        dispatchBatchId: batchId,
        status: 'dispatched',
        updatedAt: new Date(),
      })
      .where(inArray(zohoSalesOrders.id, availableOrders.map((o) => o.id)));

    // Insert records into dispatch batch orders table for tracking
    await db.insert(wmsDispatchBatchOrders).values(
      availableOrders.map((order) => ({
        batchId,
        orderId: order.id,
        orderNumber: order.salesOrderNumber,
      })),
    );

    // Calculate total cases from order items
    const orderCases = await db
      .select({
        totalCases: sql<number>`COALESCE(SUM(${zohoSalesOrderItems.quantity}), 0)::int`,
      })
      .from(zohoSalesOrderItems)
      .where(inArray(zohoSalesOrderItems.salesOrderId, availableOrders.map((o) => o.id)));

    const addedCases = orderCases[0]?.totalCases ?? 0;

    // Update batch totals
    const [updated] = await db
      .update(wmsDispatchBatches)
      .set({
        orderCount: sql`${wmsDispatchBatches.orderCount} + ${availableOrders.length}`,
        totalCases: sql`${wmsDispatchBatches.totalCases} + ${addedCases}`,
        updatedAt: new Date(),
      })
      .where(eq(wmsDispatchBatches.id, batchId))
      .returning();

    return {
      success: true,
      batch: updated,
      addedOrders: availableOrders.length,
      addedCases,
      message: `Added ${availableOrders.length} Zoho orders (${addedCases} cases) to batch`,
    };
  });

export default adminAddZohoOrdersToBatch;
