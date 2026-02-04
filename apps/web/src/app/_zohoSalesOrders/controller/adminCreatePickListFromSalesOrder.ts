/**
 * Create Pick List from Zoho Sales Order
 *
 * Creates a WMS pick list from an approved Zoho sales order.
 * Matches line items to available stock by SKU/LWIN.
 */

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import generatePickListNumber from '@/app/_wms/utils/generatePickListNumber';
import db from '@/database/client';
import {
  wmsPickListItems,
  wmsPickLists,
  wmsStock,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const adminCreatePickListFromSalesOrder = adminProcedure
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

    // Generate pick list number
    const pickListNumber = await generatePickListNumber();

    // Create pick list
    const [pickList] = await db
      .insert(wmsPickLists)
      .values({
        pickListNumber,
        orderId: salesOrderId,
        orderNumber: order.salesOrderNumber,
        totalItems: orderItems.length,
        pickedItems: 0,
      })
      .returning();

    // Create pick list items with suggested locations
    const pickListItems = [];

    for (const item of orderItems) {
      // Try to match by SKU first, then by LWIN if available
      let availableStock = [];

      if (item.lwin18) {
        availableStock = await db
          .select({
            stockId: wmsStock.id,
            locationId: wmsStock.locationId,
            availableCases: wmsStock.availableCases,
            lwin18: wmsStock.lwin18,
          })
          .from(wmsStock)
          .where(eq(wmsStock.lwin18, item.lwin18))
          .orderBy(wmsStock.availableCases);
      } else if (item.sku) {
        // Try matching by SKU (stored in lwin18 field in some cases)
        availableStock = await db
          .select({
            stockId: wmsStock.id,
            locationId: wmsStock.locationId,
            availableCases: wmsStock.availableCases,
            lwin18: wmsStock.lwin18,
          })
          .from(wmsStock)
          .where(eq(wmsStock.lwin18, item.sku))
          .orderBy(wmsStock.availableCases);
      }

      // Find first location with enough stock
      const suggestedStock = availableStock.find(
        (s) => s.availableCases >= item.quantity,
      );

      const [pickListItem] = await db
        .insert(wmsPickListItems)
        .values({
          pickListId: pickList.id,
          lwin18: item.lwin18 ?? item.sku ?? '',
          productName: item.name,
          quantityCases: item.quantity,
          suggestedLocationId: suggestedStock?.locationId ?? null,
          suggestedStockId: suggestedStock?.stockId ?? null,
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

    return {
      success: true,
      pickList,
      items: pickListItems,
      message: `Pick list ${pickListNumber} created with ${pickListItems.length} items`,
    };
  });

export default adminCreatePickListFromSalesOrder;
