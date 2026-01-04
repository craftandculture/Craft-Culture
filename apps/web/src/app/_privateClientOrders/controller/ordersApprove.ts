import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import {
  partnerMembers,
  privateClientOrderActivityLogs,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const lineItemStockSchema = z.object({
  itemId: z.string().uuid(),
  source: z.enum(['cc_inventory', 'partner_airfreight', 'partner_local', 'manual']),
  stockExpectedAt: z.date().optional(),
});

const approveOrderSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemStockSchema).optional(),
});

/**
 * Approve a private client order
 *
 * Admin approves an order that is under review.
 * The order status changes from 'under_cc_review' to 'cc_approved'.
 *
 * Optionally updates line items with stock source and expected arrival dates.
 * - CC_INVENTORY items are marked as 'confirmed' (ready in warehouse)
 * - PARTNER_AIRFREIGHT items are marked as 'pending' with an expected arrival date
 */
const ordersApprove = adminProcedure.input(approveOrderSchema).mutation(async ({ input, ctx }) => {
  const { orderId, notes, lineItems } = input;
  const { user } = ctx;

  // Fetch the order
  const order = await db.query.privateClientOrders.findFirst({
    where: { id: orderId },
  });

  if (!order) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Order not found',
    });
  }

  // Validate current status allows approval
  const validStatuses = ['submitted', 'under_cc_review'];
  if (!validStatuses.includes(order.status)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot approve order with status "${order.status}". Order must be submitted or under review.`,
    });
  }

  const previousStatus = order.status;
  const newStatus = 'cc_approved';

  // Update line items with stock source and status if provided
  if (lineItems && lineItems.length > 0) {
    for (const item of lineItems) {
      // Determine stock status based on source
      // cc_inventory = already in warehouse, mark as confirmed
      // partner_airfreight = needs sourcing, mark as pending
      const stockStatus = item.source === 'cc_inventory' ? 'confirmed' : 'pending';
      const stockConfirmedAt = item.source === 'cc_inventory' ? new Date() : null;

      await db
        .update(privateClientOrderItems)
        .set({
          source: item.source,
          stockStatus,
          stockConfirmedAt,
          stockExpectedAt: item.stockExpectedAt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(privateClientOrderItems.id, item.itemId));
    }
  }

  // Update order status
  const [updatedOrder] = await db
    .update(privateClientOrders)
    .set({
      status: newStatus,
      ccApprovedAt: new Date(),
      ccApprovedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(privateClientOrders.id, orderId))
    .returning();

  // Log the activity
  await db.insert(privateClientOrderActivityLogs).values({
    orderId,
    userId: user.id,
    action: 'order_approved',
    previousStatus,
    newStatus,
    notes,
    metadata: lineItems
      ? {
          lineItemsUpdated: lineItems.length,
          stockSources: lineItems.map((i) => ({ itemId: i.itemId, source: i.source })),
        }
      : undefined,
  });

  // Notify partner that their order was approved
  if (order.partnerId) {
    const partnerMembersList = await db
      .select({ userId: partnerMembers.userId })
      .from(partnerMembers)
      .where(eq(partnerMembers.partnerId, order.partnerId));

    for (const member of partnerMembersList) {
      await createNotification({
        userId: member.userId,
        type: 'po_approved',
        title: 'Order Approved',
        message: `Order ${updatedOrder?.orderNumber ?? orderId} has been approved by C&C. A distributor will be assigned shortly.`,
        entityType: 'private_client_order',
        entityId: orderId,
        actionUrl: `/platform/private-orders/${orderId}`,
      });
    }
  }

  return updatedOrder;
});

export default ordersApprove;
