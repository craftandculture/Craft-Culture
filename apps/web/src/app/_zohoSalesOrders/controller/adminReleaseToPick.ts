/**
 * Release Zoho Sales Order to Pick
 *
 * Directly creates a pick list for an invoiced Zoho sales order.
 * Skips the 'approved' state - goes directly from 'synced' to 'picking'.
 * Only works for orders with zohoStatus === 'invoiced' (finalized in Zoho).
 */

import { TRPCError } from '@trpc/server';
import { and, eq, gt, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

import generatePickListNumber from '@/app/_wms/utils/generatePickListNumber';
import db from '@/database/client';
import {
  wmsLocations,
  wmsPickListItems,
  wmsPickLists,
  wmsStock,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const adminReleaseToPick = adminProcedure
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

    // Must be synced status (not yet released)
    if (order.status !== 'synced') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Order has already been released. Current status: ${order.status}`,
      });
    }

    // Must be invoiced in Zoho (finalized, no more changes)
    if (order.zohoStatus !== 'invoiced') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Order must be invoiced in Zoho before release. Current Zoho status: ${order.zohoStatus}`,
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
      // Try multiple matching strategies to find stock
      let availableStock: {
        stockId: string;
        locationId: string;
        locationCode: string;
        availableCases: number;
        lwin18: string;
        productName: string;
      }[] = [];

      // Strategy 1: Match by LWIN18 (if populated)
      if (item.lwin18) {
        availableStock = await db
          .select({
            stockId: wmsStock.id,
            locationId: wmsStock.locationId,
            locationCode: wmsLocations.locationCode,
            availableCases: wmsStock.availableCases,
            lwin18: wmsStock.lwin18,
            productName: wmsStock.productName,
          })
          .from(wmsStock)
          .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
          .where(and(eq(wmsStock.lwin18, item.lwin18), gt(wmsStock.availableCases, 0)))
          .orderBy(wmsStock.availableCases);
      }

      // Strategy 2: Match by SKU (stored in lwin18 field)
      if (availableStock.length === 0 && item.sku) {
        availableStock = await db
          .select({
            stockId: wmsStock.id,
            locationId: wmsStock.locationId,
            locationCode: wmsLocations.locationCode,
            availableCases: wmsStock.availableCases,
            lwin18: wmsStock.lwin18,
            productName: wmsStock.productName,
          })
          .from(wmsStock)
          .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
          .where(and(eq(wmsStock.lwin18, item.sku), gt(wmsStock.availableCases, 0)))
          .orderBy(wmsStock.availableCases);
      }

      // Strategy 3: Match by product name (case-insensitive partial match)
      if (availableStock.length === 0 && item.name) {
        // Extract key words from product name for matching
        const searchTerms = item.name
          .split(/[\s,\-]+/)
          .filter((word) => word.length > 2)
          .slice(0, 3); // Use first 3 significant words

        if (searchTerms.length > 0) {
          // Build OR conditions for partial matching
          const conditions = searchTerms.map((term) =>
            ilike(wmsStock.productName, `%${term}%`),
          );

          availableStock = await db
            .select({
              stockId: wmsStock.id,
              locationId: wmsStock.locationId,
              locationCode: wmsLocations.locationCode,
              availableCases: wmsStock.availableCases,
              lwin18: wmsStock.lwin18,
              productName: wmsStock.productName,
            })
            .from(wmsStock)
            .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
            .where(and(or(...conditions), gt(wmsStock.availableCases, 0)))
            .orderBy(wmsStock.availableCases);
        }
      }

      // Find first location with enough stock
      const suggestedStock = availableStock.find(
        (s) => s.availableCases >= item.quantity,
      ) ?? availableStock[0]; // Fall back to any available stock if none has enough

      const [pickListItem] = await db
        .insert(wmsPickListItems)
        .values({
          pickListId: pickList.id,
          // Use matched stock's LWIN if available, otherwise fall back to order item data
          lwin18: suggestedStock?.lwin18 ?? item.lwin18 ?? item.sku ?? '',
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

    // Update sales order with pick list reference and status (skip 'approved')
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
      message: `Released to pick: ${pickListNumber} with ${pickListItems.length} items`,
    };
  });

export default adminReleaseToPick;
