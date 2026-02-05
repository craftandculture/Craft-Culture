import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  privateClientOrders,
  wmsDispatchBatchOrders,
  wmsDispatchBatches,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { updateBatchStatusSchema } from '../schemas/dispatchBatchSchema';

/**
 * Update dispatch batch status
 *
 * @example
 *   await trpcClient.wms.admin.dispatch.updateStatus.mutate({
 *     batchId: "uuid",
 *     status: "dispatched"
 *   });
 */
const adminUpdateBatchStatus = adminProcedure
  .input(updateBatchStatusSchema)
  .mutation(async ({ input, ctx }) => {
    const { batchId, status, notes } = input;

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

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      draft: ['picking', 'staged'],
      picking: ['staged', 'draft'],
      staged: ['dispatched', 'picking'],
      dispatched: ['delivered'],
      delivered: [],
    };

    const currentStatus = batch.status ?? 'draft';
    if (!validTransitions[currentStatus]?.includes(status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot transition from ${currentStatus} to ${status}`,
      });
    }

    // Build update data
    const updateData: Partial<typeof wmsDispatchBatches.$inferInsert> = {
      status,
      notes: notes ? (batch.notes ? `${batch.notes}\n${notes}` : notes) : batch.notes,
      updatedAt: new Date(),
    };

    // Set dispatch info if dispatching
    if (status === 'dispatched') {
      updateData.dispatchedAt = new Date();
      updateData.dispatchedBy = ctx.user.id;
    }

    // Set delivered info if delivered
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    }

    // Update batch
    const [updated] = await db
      .update(wmsDispatchBatches)
      .set(updateData)
      .where(eq(wmsDispatchBatches.id, batchId))
      .returning();

    // Update order statuses based on batch status
    if (status === 'dispatched' || status === 'delivered') {
      // Get all order IDs in this batch
      const batchOrders = await db
        .select({ orderId: wmsDispatchBatchOrders.orderId })
        .from(wmsDispatchBatchOrders)
        .where(eq(wmsDispatchBatchOrders.batchId, batchId));

      const orderIds = batchOrders.map((o) => o.orderId);

      if (orderIds.length > 0) {
        // Update orders: dispatched → stock_in_transit, delivered → with_distributor
        const newOrderStatus =
          status === 'dispatched' ? 'stock_in_transit' : 'with_distributor';

        await db
          .update(privateClientOrders)
          .set({
            status: newOrderStatus,
            updatedAt: new Date(),
          })
          .where(inArray(privateClientOrders.id, orderIds));
      }
    }

    return {
      success: true,
      batch: updated,
      message: `Batch status updated to ${status}`,
    };
  });

export default adminUpdateBatchStatus;
