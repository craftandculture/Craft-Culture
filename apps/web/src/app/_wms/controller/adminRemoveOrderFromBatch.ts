import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';
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
 * Remove an order from a dispatch batch
 *
 * Removes the order link and updates batch totals.
 * Only works for batches in draft or picking status.
 *
 * @example
 *   await trpcClient.wms.admin.dispatch.removeOrder.mutate({
 *     batchId: "uuid",
 *     orderId: "uuid"
 *   });
 */
const adminRemoveOrderFromBatch = adminProcedure
  .input(
    z.object({
      batchId: z.string().uuid(),
      orderId: z.string().uuid(),
    }),
  )
  .mutation(async ({ input }) => {
    const { batchId, orderId } = input;

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
        message: `Cannot remove orders from a ${batch.status} batch`,
      });
    }

    // Check if order is in the batch
    const [batchOrder] = await db
      .select()
      .from(wmsDispatchBatchOrders)
      .where(
        and(
          eq(wmsDispatchBatchOrders.batchId, batchId),
          eq(wmsDispatchBatchOrders.orderId, orderId),
        ),
      );

    if (!batchOrder) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found in batch',
      });
    }

    // Get the case count for this order to update totals
    const orderCases = await db
      .select({
        totalCases: sql<number>`COALESCE(SUM(${zohoSalesOrderItems.quantity}), 0)::int`,
      })
      .from(zohoSalesOrderItems)
      .where(eq(zohoSalesOrderItems.salesOrderId, orderId));

    const casesToRemove = orderCases[0]?.totalCases ?? 0;

    // Remove from batch orders table
    await db
      .delete(wmsDispatchBatchOrders)
      .where(
        and(
          eq(wmsDispatchBatchOrders.batchId, batchId),
          eq(wmsDispatchBatchOrders.orderId, orderId),
        ),
      );

    // Update Zoho order to remove batch link and reset status
    await db
      .update(zohoSalesOrders)
      .set({
        dispatchBatchId: null,
        status: 'picked', // Reset to picked so it can be added to another batch
        updatedAt: new Date(),
      })
      .where(eq(zohoSalesOrders.id, orderId));

    // Update batch totals
    const [updated] = await db
      .update(wmsDispatchBatches)
      .set({
        orderCount: sql`GREATEST(${wmsDispatchBatches.orderCount} - 1, 0)`,
        totalCases: sql`GREATEST(${wmsDispatchBatches.totalCases} - ${casesToRemove}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(wmsDispatchBatches.id, batchId))
      .returning();

    return {
      success: true,
      batch: updated,
      message: `Removed order ${batchOrder.orderNumber} from batch`,
    };
  });

export default adminRemoveOrderFromBatch;
