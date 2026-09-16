import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import getPartnerPricingOverrides from '@/app/_pricing/data/getPartnerPricingOverrides';
import { getPCOVariables } from '@/app/_pricing/data/getPricingConfig';
import db from '@/database/client';
import {
  orderPricingOverrides,
  privateClientOrderActivityLogs,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

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
const ordersApprove = wmsOperatorProcedure.input(approveOrderSchema).mutation(async ({ input, ctx }) => {
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

  /*
   * Approving a PCO deliberately does NOT touch wms_stock.
   *
   * The PCO module is a standalone tracking record; the WMS is the source of
   * truth for what we hold. Stock leaves on a pick, and a pick only ever comes
   * from an invoice raised in Zoho — a PCO never reaches the warehouse on its
   * own. Reserving here used to decrement availableCases at approval, but the
   * hold was only given back when the PCO reached stock_in_transit/delivered,
   * which in practice it never does because fulfilment runs through the Zoho
   * side and the PCO stays a tracking record. Every approved order therefore
   * left a permanent hold, and because the subsequent pick decrements the same
   * stock independently, wines could go availableCases-negative — the Fèvre
   * Vaulorent read -1 against 1 case on hand.
   *
   * If stock ever needs earmarking again, it belongs on pick-list release, not
   * here, so that one system owns the decrement.
   */

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

  // Snapshot pricing variables onto the order so future config changes don't affect it
  // Resolution: bespoke (manual) → partner override → global defaults
  let effectivePricing;
  if (pricingType === 'bespoke' && bespokePricing) {
    effectivePricing = bespokePricing;
  } else {
    const globalVars = await getPCOVariables();
    const partnerOverride = order.partnerId
      ? await getPartnerPricingOverrides(order.partnerId)
      : null;

    effectivePricing = {
      ccMarginPercent: partnerOverride?.ccMarginPercent ?? globalVars.ccMarginPercent,
      importDutyPercent: partnerOverride?.importDutyPercent ?? globalVars.importDutyPercent,
      transferCostPercent: partnerOverride?.transferCostPercent ?? globalVars.transferCostPercent,
      distributorMarginPercent: partnerOverride?.distributorMarginPercent ?? globalVars.distributorMarginPercent,
      vatPercent: partnerOverride?.vatPercent ?? globalVars.vatPercent,
    };
  }

  const existingOverride = await db.query.orderPricingOverrides.findFirst({
    where: { orderId },
  });

  if (existingOverride) {
    await db
      .update(orderPricingOverrides)
      .set({
        ...effectivePricing,
      })
      .where(eq(orderPricingOverrides.id, existingOverride.id));
  } else {
    await db.insert(orderPricingOverrides).values({
      orderId,
      ...effectivePricing,
      createdBy: user.id,
      notes: pricingType === 'bespoke'
        ? 'Bespoke pricing set during approval'
        : 'Standard pricing snapshot at approval',
    });
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
