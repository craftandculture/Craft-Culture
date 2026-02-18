import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  privateClientOrderItems,
  privateClientOrders,
  wmsDispatchBatchOrders,
  wmsDispatchBatches,
  wmsStockMovements,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { updateBatchStatusSchema } from '../schemas/dispatchBatchSchema';
import generateMovementNumber from '../utils/generateMovementNumber';

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
        .select({
          orderId: wmsDispatchBatchOrders.orderId,
          orderNumber: wmsDispatchBatchOrders.orderNumber,
        })
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

        // Update Zoho orders (IDs that don't match Zoho rows are no-ops)
        const newZohoStatus =
          status === 'dispatched' ? 'dispatched' : 'delivered';

        await db
          .update(zohoSalesOrders)
          .set({
            status: newZohoStatus,
            updatedAt: new Date(),
          })
          .where(inArray(zohoSalesOrders.id, orderIds));

        // Create dispatch movement records for audit trail
        if (status === 'dispatched') {
          // Get line items from Zoho orders
          const zohoItems = await db
            .select({
              lwin18: zohoSalesOrderItems.lwin18,
              productName: zohoSalesOrderItems.name,
              quantity: zohoSalesOrderItems.quantity,
              orderId: zohoSalesOrderItems.salesOrderId,
            })
            .from(zohoSalesOrderItems)
            .where(inArray(zohoSalesOrderItems.salesOrderId, orderIds));

          // Get line items from PCO orders
          const pcoItems = await db
            .select({
              lwin18: privateClientOrderItems.lwin,
              productName: privateClientOrderItems.productName,
              quantity: privateClientOrderItems.quantity,
              orderId: privateClientOrderItems.orderId,
            })
            .from(privateClientOrderItems)
            .where(inArray(privateClientOrderItems.orderId, orderIds));

          const allItems = [...zohoItems, ...pcoItems].filter(
            (item) => item.lwin18 && item.quantity > 0,
          );

          // Build order number lookup
          const orderNumberMap = new Map(
            batchOrders.map((o) => [o.orderId, o.orderNumber]),
          );

          for (const item of allItems) {
            const movementNumber = await generateMovementNumber();
            await db.insert(wmsStockMovements).values({
              movementNumber,
              movementType: 'dispatch',
              lwin18: item.lwin18 ?? 'UNKNOWN',
              productName: item.productName ?? 'Unknown Product',
              quantityCases: item.quantity,
              orderId: item.orderId,
              notes: `Batch ${batch.batchNumber} → ${batch.distributorName} (${orderNumberMap.get(item.orderId) ?? ''})`,
              performedBy: ctx.user.id,
              performedAt: new Date(),
            });
          }
        }
      }
    }

    return {
      success: true,
      batch: updated,
      message: `Batch status updated to ${status}`,
    };
  });

export default adminUpdateBatchStatus;
