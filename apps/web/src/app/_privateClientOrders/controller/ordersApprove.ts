import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
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
import { adminProcedure } from '@/lib/trpc/procedures';

import { MANUAL_PRICING_NOTE } from './adminSetPricing';
import notifyPartnerOfOrderUpdate from '../utils/notifyPartnerOfOrderUpdate';
import recalculateOrderTotals from '../utils/recalculateOrderTotals';

const lineItemStockSchema = z.object({
  itemId: z.string().uuid(),
  source: z.enum(['cc_inventory', 'partner_airfreight', 'partner_local', 'manual']),
  stockExpectedAt: z.date().optional(),
});

// A margin is taken off the price (price ÷ (1 − margin)), so 100% would divide by zero
const marginPercent = z.number().min(0).lt(100);
const ratePercent = z.number().min(0).max(100);

const bespokePricingSchema = z.object({
  ccMarginPercent: marginPercent.optional(),
  importDutyPercent: ratePercent.optional(),
  transferCostPercent: ratePercent.optional(),
  distributorMarginPercent: marginPercent.optional(),
  vatPercent: ratePercent.optional(),
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

  // Every line named must be on this order
  if (lineItems && lineItems.length > 0) {
    const ownLines = await db
      .select({ id: privateClientOrderItems.id })
      .from(privateClientOrderItems)
      .where(
        and(
          eq(privateClientOrderItems.orderId, orderId),
          inArray(
            privateClientOrderItems.id,
            lineItems.map((item) => item.itemId),
          ),
        ),
      );
    if (ownLines.length !== new Set(lineItems.map((item) => item.itemId)).size) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Some of those lines are not on this order',
      });
    }
  }

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
        // Only this order's own lines
        .where(
          and(
            eq(privateClientOrderItems.id, item.itemId),
            eq(privateClientOrderItems.orderId, orderId),
          ),
        );
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

  // Update order status, only if it is still awaiting approval (no double approval)
  const [approvedOrder] = await db
    .update(privateClientOrders)
    .set({
      status: newStatus,
      ccApprovedAt: new Date(),
      ccApprovedBy: user.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(privateClientOrders.id, orderId),
        inArray(privateClientOrders.status, ['submitted', 'under_cc_review']),
      ),
    )
    .returning();

  if (!approvedOrder) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'This order has already been approved or has changed. Refresh and try again.',
    });
  }

  let updatedOrder = approvedOrder;

  // Snapshot pricing variables onto the order so future config changes don't affect it
  // Resolution, field by field: bespoke (manual) → partner override → global defaults
  const globalVars = await getPCOVariables();
  const partnerOverride = order.partnerId
    ? await getPartnerPricingOverrides(order.partnerId)
    : null;

  const standardPricing = {
    ccMarginPercent: partnerOverride?.ccMarginPercent ?? globalVars.ccMarginPercent,
    importDutyPercent: partnerOverride?.importDutyPercent ?? globalVars.importDutyPercent,
    transferCostPercent: partnerOverride?.transferCostPercent ?? globalVars.transferCostPercent,
    distributorMarginPercent: partnerOverride?.distributorMarginPercent ?? globalVars.distributorMarginPercent,
    vatPercent: partnerOverride?.vatPercent ?? globalVars.vatPercent,
  };

  const bespoke = pricingType === 'bespoke' ? bespokePricing : undefined;
  const isBespoke = !!bespoke;

  /*
    A figure left out of the bespoke rates used to be stored as null, and a
    null later fell back to the global rate even where the partner has its
    own. Each one left out now takes the partner's rate, then the global.
  */
  const effectivePricing = bespoke
    ? {
        ccMarginPercent: bespoke.ccMarginPercent ?? standardPricing.ccMarginPercent,
        importDutyPercent: bespoke.importDutyPercent ?? standardPricing.importDutyPercent,
        transferCostPercent: bespoke.transferCostPercent ?? standardPricing.transferCostPercent,
        distributorMarginPercent:
          bespoke.distributorMarginPercent ?? standardPricing.distributorMarginPercent,
        vatPercent: bespoke.vatPercent ?? standardPricing.vatPercent,
      }
    : standardPricing;

  const existingOverride = await db.query.orderPricingOverrides.findFirst({
    where: { orderId },
  });

  /*
    Rates someone set on this order by hand are kept: approving with standard
    pricing used to overwrite them with the partner's or global rates.
  */
  const keepManual =
    existingOverride?.notes === MANUAL_PRICING_NOTE && pricingType !== 'bespoke';

  if (existingOverride && !keepManual) {
    await db
      .update(orderPricingOverrides)
      .set({
        ...effectivePricing,
      })
      .where(eq(orderPricingOverrides.id, existingOverride.id));
  } else if (!existingOverride) {
    await db.insert(orderPricingOverrides).values({
      orderId,
      ...effectivePricing,
      createdBy: user.id,
      notes: pricingType === 'bespoke'
        ? 'Bespoke pricing set during approval'
        : 'Standard pricing snapshot at approval',
    });
  }

  /*
    Bespoke rates change the client price, so the order's totals are worked
    out again from them now. Without this the order kept the totals from the
    old rates, and the Zoho sales order raised from it disagreed with them.
  */
  if (isBespoke) {
    await recalculateOrderTotals(orderId);
    const refreshed = await db.query.privateClientOrders.findFirst({
      where: { id: orderId },
    });
    if (refreshed) updatedOrder = refreshed;
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
      orderNumber: updatedOrder.orderNumber ?? order.orderNumber ?? orderId,
      partnerId: order.partnerId,
      type: 'approved',
      totalAmount: updatedOrder.totalUsd ?? 0,
      clientName: order.clientName ?? 'Client',
    });
  }

  return updatedOrder;
});

export default ordersApprove;
