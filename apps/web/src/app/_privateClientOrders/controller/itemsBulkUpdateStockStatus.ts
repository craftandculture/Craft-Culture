import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import {
  partnerMembers,
  privateClientOrderActivityLogs,
  privateClientOrderItems,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const stockStatusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_transit_to_cc: 'In Transit to C&C',
  at_cc_bonded: 'At C&C Bonded',
  at_cc_ready_for_dispatch: 'Packed',
  in_transit_to_distributor: 'In Transit to Distributor',
  at_distributor: 'At Distributor',
  delivered: 'Delivered',
};

const bulkUpdateStockStatusSchema = z.object({
  orderId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1),
  stockStatus: z.enum([
    'pending',
    'confirmed',
    'in_transit_to_cc',
    'at_cc_bonded',
    'at_cc_ready_for_dispatch',
    'in_transit_to_distributor',
    'at_distributor',
    'delivered',
  ]),
  stockExpectedAt: z.date().optional(),
  stockNotes: z.string().optional(),
});

/**
 * Bulk update stock status for multiple line items
 *
 * Admin procedure to update stock status for multiple items at once.
 * Useful for marking entire shipments as arrived or ready.
 */
const itemsBulkUpdateStockStatus = adminProcedure
  .input(bulkUpdateStockStatusSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, itemIds, stockStatus, stockExpectedAt, stockNotes } = input;
    const { user } = ctx;

    // Verify order exists
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId },
      columns: { id: true, status: true, partnerId: true, distributorId: true, orderNumber: true },
    });

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    // Cannot update stock status for orders that are cancelled
    if (order.status === 'cancelled') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot update stock status for cancelled orders',
      });
    }

    // Verify all items belong to this order
    const items = await db
      .select({
        id: privateClientOrderItems.id,
        productName: privateClientOrderItems.productName,
        stockStatus: privateClientOrderItems.stockStatus,
      })
      .from(privateClientOrderItems)
      .where(inArray(privateClientOrderItems.id, itemIds));

    if (items.length !== itemIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Some items not found or do not belong to this order',
      });
    }

    const now = new Date();

    // Build update data
    const updateData: {
      stockStatus: typeof stockStatus;
      stockExpectedAt?: Date | null;
      stockNotes?: string | null;
      stockConfirmedAt?: Date | null;
      updatedAt: Date;
    } = {
      stockStatus,
      updatedAt: now,
    };

    // Set confirmed timestamp when status changes to confirmed
    if (stockStatus === 'confirmed') {
      updateData.stockConfirmedAt = now;
    }

    // Update expected arrival date if provided
    if (stockExpectedAt !== undefined) {
      updateData.stockExpectedAt = stockExpectedAt;
    }

    // Update notes if provided
    if (stockNotes !== undefined) {
      updateData.stockNotes = stockNotes;
    }

    // Bulk update all items
    await db
      .update(privateClientOrderItems)
      .set(updateData)
      .where(inArray(privateClientOrderItems.id, itemIds));

    // Log the activity
    const itemNames = items.map((i) => i.productName).join(', ');
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      action: 'stock_status_bulk_updated',
      notes: stockNotes ?? `Bulk updated ${items.length} items to ${stockStatusLabels[stockStatus]}`,
      metadata: {
        itemIds,
        itemCount: items.length,
        newStockStatus: stockStatus,
        stockExpectedAt: stockExpectedAt?.toISOString(),
        itemNames,
      },
    });

    // Send notifications
    const statusLabel = stockStatusLabels[stockStatus] ?? stockStatus;
    const orderRef = order.orderNumber ?? order.id;

    // Notify partner
    if (order.partnerId) {
      const partnerMembersList = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.partnerId));

      for (const member of partnerMembersList) {
        await createNotification({
          userId: member.userId,
          partnerId: order.partnerId,
          type: 'status_update',
          title: 'Stock Status Updated',
          message: `${items.length} items for order ${orderRef}: ${statusLabel}`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/private-orders/${orderId}`,
        });
      }
    }

    // Notify distributor when stock is in transit to them, arrives at C&C, or at distributor
    if (
      order.distributorId &&
      (stockStatus === 'at_cc_bonded' ||
        stockStatus === 'in_transit_to_distributor' ||
        stockStatus === 'at_distributor')
    ) {
      const distributorMembersList = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.distributorId));

      const notificationTitle =
        stockStatus === 'at_distributor'
          ? 'Stock Ready for Pickup'
          : stockStatus === 'in_transit_to_distributor'
            ? 'Stock In Transit'
            : 'Stock Arrived at C&C';

      for (const member of distributorMembersList) {
        await createNotification({
          userId: member.userId,
          partnerId: order.distributorId,
          type: 'status_update',
          title: notificationTitle,
          message: `${items.length} items for order ${orderRef}: ${statusLabel}`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/distributor/orders/${orderId}`,
        });
      }
    }

    return {
      updatedCount: items.length,
      status: stockStatus,
    };
  });

export default itemsBulkUpdateStockStatus;
