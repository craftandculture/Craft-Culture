import { TRPCError } from '@trpc/server';
import { eq, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  privateClientOrderItems,
  privateClientOrders,
  wmsDispatchBatchOrders,
  wmsDispatchBatches,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { addOrdersToBatchSchema } from '../schemas/dispatchBatchSchema';

/**
 * Add orders to a dispatch batch
 * Updates batch totals after adding
 *
 * @example
 *   await trpcClient.wms.admin.dispatch.addOrders.mutate({
 *     batchId: "uuid",
 *     orderIds: ["order-uuid-1", "order-uuid-2"]
 *   });
 */
const adminAddOrdersToBatch = adminProcedure
  .input(addOrdersToBatchSchema)
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

    // Get orders
    const orders = await db
      .select({
        id: privateClientOrders.id,
        orderNumber: privateClientOrders.orderNumber,
        distributorId: privateClientOrders.distributorId,
      })
      .from(privateClientOrders)
      .where(inArray(privateClientOrders.id, orderIds));

    if (orders.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No orders found',
      });
    }

    // Check existing orders in batch
    const existingOrders = await db
      .select({ orderId: wmsDispatchBatchOrders.orderId })
      .from(wmsDispatchBatchOrders)
      .where(eq(wmsDispatchBatchOrders.batchId, batchId));

    const existingOrderIds = new Set(existingOrders.map((o) => o.orderId));

    // Filter to only new orders
    const newOrders = orders.filter((o) => !existingOrderIds.has(o.id));

    if (newOrders.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'All orders are already in this batch',
      });
    }

    // Add orders to batch
    await db.insert(wmsDispatchBatchOrders).values(
      newOrders.map((order) => ({
        batchId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        addedAt: new Date(),
      })),
    );

    // Calculate total cases from order items
    const orderCases = await db
      .select({
        totalCases: sql<number>`COALESCE(SUM(${privateClientOrderItems.quantityCases}), 0)::int`,
      })
      .from(privateClientOrderItems)
      .where(inArray(privateClientOrderItems.orderId, newOrders.map((o) => o.id)));

    const addedCases = orderCases[0]?.totalCases ?? 0;

    // Update batch totals
    const [updated] = await db
      .update(wmsDispatchBatches)
      .set({
        orderCount: sql`${wmsDispatchBatches.orderCount} + ${newOrders.length}`,
        totalCases: sql`${wmsDispatchBatches.totalCases} + ${addedCases}`,
        updatedAt: new Date(),
      })
      .where(eq(wmsDispatchBatches.id, batchId))
      .returning();

    return {
      success: true,
      batch: updated,
      addedOrders: newOrders.length,
      addedCases,
      message: `Added ${newOrders.length} orders (${addedCases} cases) to batch`,
    };
  });

export default adminAddOrdersToBatch;
