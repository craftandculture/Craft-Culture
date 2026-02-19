import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import reserveStockForOrderItems from '@/app/_wms/utils/reserveStockForOrderItems';
import db from '@/database/client';
import {
  orderPricingOverrides,
  privateClientOrderActivityLogs,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import notifyPartnerOfOrderUpdate from '../utils/notifyPartnerOfOrderUpdate';

const lineItemStockSchema = z.object({
  itemId: z.string().uuid(),
  source: z.enum(['cc_inventory', 'partner_airfreight', 'partner_local', 'manual']),
  stockExpectedAt: z.date().optional(),
});

const bespokePricingSchema = z.object({
  ccMarginPercent: z.number().optional(),
  importDutyPercent: z.number().optional(),
  transferCostPercent: z.number().optional(),
  distributorMarginPercent: z.number().optional(),
  vatPercent: z.number().optional(),
});

const approveOrderSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemStockSchema).optional(),
  pricingType: z.enum(['standard', 'bespoke']).default('standard'),
  bespokePricing: bespokePricingSchema.optional(),
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
  const { orderId, notes, lineItems, pricingType, bespokePricing } = input;
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

  // Reserve WMS stock for cc_inventory items
  if (lineItems && lineItems.length > 0) {
    const ccInventoryItemIds = lineItems
      .filter((item) => item.source === 'cc_inventory')
      .map((item) => item.itemId);

    if (ccInventoryItemIds.length > 0) {
      const ccItems = await db
        .select({
          id: privateClientOrderItems.id,
          lwin: privateClientOrderItems.lwin,
          productName: privateClientOrderItems.productName,
          quantity: privateClientOrderItems.quantity,
        })
        .from(privateClientOrderItems)
        .where(
          eq(privateClientOrderItems.orderId, orderId),
        );

      const reservationItems = ccItems
        .filter(
          (item) =>
            item.lwin && ccInventoryItemIds.includes(item.id),
        )
        .map((item) => ({
          orderItemId: item.id,
          lwin18: item.lwin!,
          productName: item.productName,
          quantityCases: item.quantity,
        }));

      if (reservationItems.length > 0) {
        await reserveStockForOrderItems({
          orderType: 'pco',
          orderId,
          orderNumber: order.orderNumber ?? orderId,
          items: reservationItems,
          db,
        });
      }
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

  // Save bespoke pricing if selected
  if (pricingType === 'bespoke' && bespokePricing) {
    // Check if override already exists
    const existingOverride = await db.query.orderPricingOverrides.findFirst({
      where: { orderId },
    });

    if (existingOverride) {
      await db
        .update(orderPricingOverrides)
        .set({
          ...bespokePricing,
        })
        .where(eq(orderPricingOverrides.id, existingOverride.id));
    } else {
      await db.insert(orderPricingOverrides).values({
        orderId,
        ...bespokePricing,
        createdBy: user.id,
        notes: `Bespoke pricing set during approval`,
      });
    }
  }

  // Log the activity
  await db.insert(privateClientOrderActivityLogs).values({
    orderId,
    userId: user.id,
    action: 'order_approved',
    previousStatus,
    newStatus,
    notes,
    metadata: {
      ...(lineItems && {
        lineItemsUpdated: lineItems.length,
        stockSources: lineItems.map((i) => ({ itemId: i.itemId, source: i.source })),
      }),
      pricingType,
      ...(pricingType === 'bespoke' && bespokePricing && { bespokePricing }),
    },
  });

  // Notify partner that their order was approved
  if (order.partnerId) {
    await notifyPartnerOfOrderUpdate({
      orderId,
      orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
      partnerId: order.partnerId,
      type: 'approved',
      totalAmount: order.totalUsd ?? 0,
      clientName: order.clientName ?? 'Client',
    });
  }

  return updatedOrder;
});

export default ordersApprove;
