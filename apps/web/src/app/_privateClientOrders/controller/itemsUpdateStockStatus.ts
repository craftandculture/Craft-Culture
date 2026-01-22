import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
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

const updateStockStatusSchema = z.object({
  itemId: z.string().uuid(),
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
 * Update the stock status of a line item
 *
 * Admin procedure to track stock movement for individual line items.
 * Updates the stock status and optionally the expected arrival date and notes.
 * Logs the change for audit purposes.
 */
const itemsUpdateStockStatus = adminProcedure
  .input(updateStockStatusSchema)
  .mutation(async ({ input, ctx }) => {
    const { itemId, stockStatus, stockExpectedAt, stockNotes } = input;
    const { user } = ctx;

    // Fetch the item with its order
    const item = await db.query.privateClientOrderItems.findFirst({
      where: { id: itemId },
      with: {
        order: {
          columns: { id: true, status: true, partnerId: true, distributorId: true, orderNumber: true },
        },
      },
    });

    if (!item) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Item not found',
      });
    }

    // Cannot update stock status for orders that are still in draft or cancelled
    const invalidStatuses = ['draft', 'cancelled'];
    if (invalidStatuses.includes(item.order.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot update stock status for orders in draft or cancelled status',
      });
    }

    const previousStatus = item.stockStatus;

    // Build update data
    const updateData: {
      stockStatus: typeof stockStatus;
      stockExpectedAt?: Date | null;
      stockNotes?: string | null;
      stockConfirmedAt?: Date | null;
      updatedAt: Date;
    } = {
      stockStatus,
      updatedAt: new Date(),
    };

    // Set confirmed timestamp when status changes to confirmed
    if (stockStatus === 'confirmed' && previousStatus !== 'confirmed') {
      updateData.stockConfirmedAt = new Date();
    }

    // Update expected arrival date if provided
    if (stockExpectedAt !== undefined) {
      updateData.stockExpectedAt = stockExpectedAt;
    }

    // Update notes if provided
    if (stockNotes !== undefined) {
      updateData.stockNotes = stockNotes;
    }

    // Update the item
    const [updatedItem] = await db
      .update(privateClientOrderItems)
      .set(updateData)
      .where(eq(privateClientOrderItems.id, itemId))
      .returning();

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId: item.order.id,
      userId: user.id,
      action: 'stock_status_updated',
      notes: stockNotes,
      metadata: {
        itemId,
        productName: item.productName,
        previousStockStatus: previousStatus,
        newStockStatus: stockStatus,
        stockExpectedAt: stockExpectedAt?.toISOString(),
      },
    });

    // Send notifications when stock status changes
    if (previousStatus !== stockStatus) {
      const statusLabel = stockStatusLabels[stockStatus] ?? stockStatus;
      const orderRef = item.order.orderNumber ?? item.order.id;
      const productName = item.productName;

      // Notify partner
      if (item.order.partnerId) {
        const partnerMembersList = await db
          .select({ userId: partnerMembers.userId })
          .from(partnerMembers)
          .where(eq(partnerMembers.partnerId, item.order.partnerId));

        for (const member of partnerMembersList) {
          await createNotification({
            userId: member.userId,
            partnerId: item.order.partnerId,
            type: 'status_update',
            title: 'Stock Status Updated',
            message: `${productName} for order ${orderRef}: ${statusLabel}`,
            entityType: 'private_client_order',
            entityId: item.order.id,
            actionUrl: `/platform/private-orders/${item.order.id}`,
          });
        }
      }

      // Notify distributor when stock is in transit to them, arrives at C&C, or at distributor
      if (
        item.order.distributorId &&
        (stockStatus === 'at_cc_bonded' ||
          stockStatus === 'in_transit_to_distributor' ||
          stockStatus === 'at_distributor')
      ) {
        const distributorMembersList = await db
          .select({ userId: partnerMembers.userId })
          .from(partnerMembers)
          .where(eq(partnerMembers.partnerId, item.order.distributorId));

        const notificationTitle =
          stockStatus === 'at_distributor'
            ? 'Stock Ready for Pickup'
            : stockStatus === 'in_transit_to_distributor'
              ? 'Stock In Transit'
              : 'Stock Arrived at C&C';

        for (const member of distributorMembersList) {
          await createNotification({
            userId: member.userId,
            partnerId: item.order.distributorId,
            type: 'status_update',
            title: notificationTitle,
            message: `${productName} for order ${orderRef}: ${statusLabel}`,
            entityType: 'private_client_order',
            entityId: item.order.id,
            actionUrl: `/platform/distributor/orders/${item.order.id}`,
          });
        }
      }
    }

    return updatedItem;
  });

export default itemsUpdateStockStatus;
