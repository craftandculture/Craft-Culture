/**
 * Create Pick List from Zoho Sales Order
 *
 * Creates a WMS pick list from an approved Zoho sales order.
 * Matches line items to available stock by SKU/LWIN.
 */

import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import getOwnerDeliveryOwners from '@/app/_cellar/data/getOwnerDeliveryOwners';
import announcePickList from '@/app/_wms/data/announcePickList';
import generatePickListNumber from '@/app/_wms/utils/generatePickListNumber';
import resolvePickStock from '@/app/_wms/utils/resolvePickStock';
import db from '@/database/client';
import {
  wmsPickListItems,
  wmsPickLists,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import resolvePickQuantities from '../../_wms/utils/resolvePickQuantities';

/**
 * Convert a raw SKU (18 digits, no dashes) to LWIN18 format (with dashes)
 *
 * @example
 *   formatSkuAsLwin18('100805220210600750') // '1008052-2021-06-00750'
 */
const formatSkuAsLwin18 = (sku: string) => {
  const digits = sku.replace(/\D/g, '');
  if (digits.length !== 18) return sku;
  return `${digits.slice(0, 7)}-${digits.slice(7, 11)}-${digits.slice(11, 13)}-${digits.slice(13)}`;
};

const adminCreatePickListFromSalesOrder = wmsOperatorProcedure
  .input(z.object({ salesOrderId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const { salesOrderId } = input;

    // Get the sales order
    const [order] = await db
      .select()
      .from(zohoSalesOrders)
      .where(eq(zohoSalesOrders.id, salesOrderId));

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Sales order not found',
      });
    }

    // Must be approved status
    if (order.status !== 'approved') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Order must be approved before creating pick list. Current status: ${order.status}`,
      });
    }

    // Check if pick list already exists
    if (order.pickListId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Pick list already exists for this order',
      });
    }

    // Get order items
    const orderItems = await db
      .select()
      .from(zohoSalesOrderItems)
      .where(eq(zohoSalesOrderItems.salesOrderId, salesOrderId));

    if (orderItems.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Sales order has no items',
      });
    }

    /*
      Claim the order before building anything. Two presses of the button
      used to both see "no pick list yet" and each create one, sending two
      people to the same bay for the same cases. Only the press that moves the
      order from approved to picking goes on; the other is told it is done.
    */
    const [claimed] = await db
      .update(zohoSalesOrders)
      .set({ status: 'picking', updatedAt: new Date() })
      .where(
        and(
          eq(zohoSalesOrders.id, salesOrderId),
          eq(zohoSalesOrders.status, 'approved'),
          isNull(zohoSalesOrders.pickListId),
        ),
      )
      .returning({ id: zohoSalesOrders.id });

    if (!claimed) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'A pick list is already being created for this order',
      });
    }

    let pickList: typeof wmsPickLists.$inferSelect | undefined;
    let pickListNumber: string;

    try {
      // Generate pick list number
      pickListNumber = await generatePickListNumber();

      // Create pick list
      [pickList] = await db
        .insert(wmsPickLists)
        .values({
          pickListNumber,
          orderId: salesOrderId,
          orderNumber: order.salesOrderNumber,
          totalItems: orderItems.length,
          pickedItems: 0,
        })
        .returning();
    } catch (error) {
      // Hand the order back so it can be released again
      await db
        .update(zohoSalesOrders)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(and(eq(zohoSalesOrders.id, salesOrderId), isNull(zohoSalesOrders.pickListId)));
      throw error;
    }

    if (!pickList) {
      await db
        .update(zohoSalesOrders)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(and(eq(zohoSalesOrders.id, salesOrderId), isNull(zohoSalesOrders.pickListId)));
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The pick list could not be created. Try again.',
      });
    }

    // Create pick list items with suggested locations
    const pickListItems = [];
    // A member's own delivery comes only from their own bottles
    const ownDelivery = (await getOwnerDeliveryOwners([salesOrderId])).get(salesOrderId);

    for (const item of orderItems) {
      // Resolve LWIN18: use explicit lwin18 field, or convert SKU to LWIN18 format
      const resolvedLwin18 = item.lwin18
        ? item.lwin18
        : item.sku
          ? formatSkuAsLwin18(item.sku)
          : '';

      // Pack-agnostic, in-stock-only match by LWIN7+vintage with a safe name
      // fallback — never pins an empty pack or a lookalike cuvée (this is the
      // path that mis-matched Talenti Brunello to the empty Talenti Piero pack).
      const suggestedStock = await resolvePickStock({
        ownerId: ownDelivery?.ownerId,
        lwin18: resolvedLwin18,
        productName: item.name,
        neededCases: item.quantity,
        db,
      });

      // Bottles vs cases — shared with release-to-pick and the re-sync so a
      // single-bottle line can never become "1 case" of a 6-pack again.
      const quantities = resolvePickQuantities({
        quantity: item.quantity,
        unit: item.unit,
        description: item.description,
        sku: item.sku ?? resolvedLwin18,
        stockCaseConfig: suggestedStock?.caseConfig,
      });

      const [pickListItem] = await db
        .insert(wmsPickListItems)
        .values({
          pickListId: pickList.id,
          lwin18: suggestedStock?.lwin18 ?? resolvedLwin18,
          productName: item.name,
          quantityCases: quantities.casesNeeded,
          quantityBottles: quantities.quantityBottles,
          suggestedLocationId: suggestedStock?.locationId ?? null,
          suggestedStockId: suggestedStock?.stockId ?? null,
          notes:
            suggestedStock?.matchedBy === 'name'
              ? 'VERIFY: matched by name (no LWIN match) — confirm the wine'
              : null,
        })
        .returning();

      pickListItems.push(pickListItem);

      // Update zoho sales order item with stock reference
      if (suggestedStock) {
        await db
          .update(zohoSalesOrderItems)
          .set({ stockId: suggestedStock.stockId })
          .where(eq(zohoSalesOrderItems.id, item.id));
      }
    }

    // Update sales order with pick list reference and status
    await db
      .update(zohoSalesOrders)
      .set({
        pickListId: pickList.id,
        status: 'picking',
        updatedAt: new Date(),
      })
      .where(eq(zohoSalesOrders.id, salesOrderId));

    // Tell #warehouse-activity a new list is out to the floor
    if (pickList) await announcePickList(pickList.id, 'released');

    return {
      success: true,
      pickList,
      items: pickListItems,
      message: `Pick list ${pickListNumber} created with ${pickListItems.length} items`,
    };
  });

export default adminCreatePickListFromSalesOrder;
