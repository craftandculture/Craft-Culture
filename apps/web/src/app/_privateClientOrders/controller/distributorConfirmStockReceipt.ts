import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrderItems } from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

import notifyPartnerOfOrderUpdate from '../utils/notifyPartnerOfOrderUpdate';

const confirmStockReceiptSchema = z.object({
  orderId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1),
  notes: z.string().optional(),
});

/**
 * Confirm stock receipt at distributor warehouse
 *
 * Distributor procedure to mark items as received at their warehouse.
 * This moves items from 'in_transit_to_distributor' to 'at_distributor' status.
 * Items can also be confirmed from earlier statuses (e.g. at_cc_bonded).
 */
const distributorConfirmStockReceipt = distributorProcedure
  .input(confirmStockReceiptSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, itemIds, notes } = input;
    const { partnerId, user } = ctx;

    // Verify order belongs to this distributor
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId, distributorId: partnerId },
      columns: { id: true, status: true, partnerId: true, orderNumber: true },
    });

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found or not assigned to you',
      });
    }

    // Cannot update stock status for cancelled orders
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
        orderId: privateClientOrderItems.orderId,
        productName: privateClientOrderItems.productName,
        stockStatus: privateClientOrderItems.stockStatus,
      })
      .from(privateClientOrderItems)
      .where(inArray(privateClientOrderItems.id, itemIds));

    // Check all items belong to this order
    const invalidItems = items.filter((item) => item.orderId !== orderId);
    if (invalidItems.length > 0 || items.length !== itemIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Some items not found or do not belong to this order',
      });
    }

    // Validate stock status - items must be at C&C or in transit before distributor can confirm receipt
    const validStatuses = ['at_cc_bonded', 'in_transit_to_distributor'];
    const itemsNotReady = items.filter((item) => !validStatuses.includes(item.stockStatus ?? ''));
    if (itemsNotReady.length > 0) {
      const itemNames = itemsNotReady.map((i) => i.productName).join(', ');
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot confirm receipt: ${itemNames} - stock must be at C&C warehouse first`,
      });
    }

    const now = new Date();

    // Update all items to at_distributor
    await db
      .update(privateClientOrderItems)
      .set({
        stockStatus: 'at_distributor',
        updatedAt: now,
      })
      .where(inArray(privateClientOrderItems.id, itemIds));

    // Log the activity
    const itemNames = items.map((i) => i.productName).join(', ');
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId,
      action: 'stock_received_at_distributor',
      notes: notes ?? `Distributor confirmed receipt of ${items.length} items`,
      metadata: {
        itemIds,
        itemCount: items.length,
        itemNames,
        previousStatuses: items.map((i) => ({
          itemId: i.id,
          previousStatus: i.stockStatus,
        })),
      },
    });

    // Notify partner that stock has arrived at distributor (in-app + email)
    if (order.partnerId) {
      await notifyPartnerOfOrderUpdate({
        orderId,
        orderNumber: order.orderNumber ?? orderId,
        partnerId: order.partnerId,
        type: 'stock_received',
        notes: `${items.length} item(s) confirmed at distributor warehouse`,
      });
    }

    return {
      updatedCount: items.length,
      status: 'at_distributor',
    };
  });

export default distributorConfirmStockReceipt;
