/**
 * Release Zoho Sales Order to Pick
 *
 * Directly creates a pick list for an invoiced Zoho sales order.
 * Skips the 'approved' state - goes directly from 'synced' to 'picking'.
 * Only works for orders with zohoStatus === 'invoiced' (finalized in Zoho).
 */

import { TRPCError } from '@trpc/server';
import { and, eq, gt, ilike } from 'drizzle-orm';
import { z } from 'zod';

import generatePickListNumber from '@/app/_wms/utils/generatePickListNumber';
import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import db from '@/database/client';
import {
  wmsLocations,
  wmsPickListItems,
  wmsPickLists,
  wmsStock,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

const adminReleaseToPick = wmsOperatorProcedure
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
    const unresolvedItems: string[] = [];

    for (const item of orderItems) {
      // Normalize LWIN18 to dashed format (Zoho imports may lack dashes)
      const itemLwin18 = item.lwin18 ? normalizeLwin18(item.lwin18) : null;

      // Try multiple matching strategies to find stock
      let availableStock: {
        stockId: string;
        locationId: string;
        locationCode: string;
        availableCases: number;
        lwin18: string;
        productName: string;
        caseConfig: number | null;
      }[] = [];

      // Strategy 1: Match by LWIN18 (if populated)
      if (itemLwin18) {
        availableStock = await db
          .select({
            stockId: wmsStock.id,
            locationId: wmsStock.locationId,
            locationCode: wmsLocations.locationCode,
            availableCases: wmsStock.availableCases,
            lwin18: wmsStock.lwin18,
            productName: wmsStock.productName,
            caseConfig: wmsStock.caseConfig,
          })
          .from(wmsStock)
          .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
          .where(and(eq(wmsStock.lwin18, itemLwin18), gt(wmsStock.availableCases, 0)))
          .orderBy(wmsStock.availableCases);
      }

      // Strategy 2: Match by SKU (normalize to dashed format for comparison)
      if (availableStock.length === 0 && item.sku) {
        const normalizedSku = normalizeLwin18(item.sku);
        availableStock = await db
          .select({
            stockId: wmsStock.id,
            locationId: wmsStock.locationId,
            locationCode: wmsLocations.locationCode,
            availableCases: wmsStock.availableCases,
            lwin18: wmsStock.lwin18,
            productName: wmsStock.productName,
            caseConfig: wmsStock.caseConfig,
          })
          .from(wmsStock)
          .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
          .where(and(eq(wmsStock.lwin18, normalizedSku), gt(wmsStock.availableCases, 0)))
          .orderBy(wmsStock.availableCases);
      }

      // Strategy 3: Match by product name (case-insensitive, ALL terms must match)
      if (availableStock.length === 0 && item.name) {
        // Extract key words from product name for matching. Exclude vintage
        // years (e.g. "2022") — WMS stock product names don't carry the
        // vintage (it lives in a separate column), so requiring the year to
        // appear in the name would make every match fail.
        const searchTerms = item.name
          .split(/[\s,\-]+/)
          .filter((word) => word.length > 2 && !/^(19|20)\d{2}$/.test(word))
          .slice(0, 8); // Use up to 8 significant words for better disambiguation

        if (searchTerms.length > 0) {
          // Build AND conditions — all terms must appear in product name
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
              caseConfig: wmsStock.caseConfig,
            })
            .from(wmsStock)
            .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
            .where(and(...conditions, gt(wmsStock.availableCases, 0)))
            .orderBy(wmsStock.availableCases);
        }
      }

      // Resolve the pick in BOTTLES so a single ordered from a larger case is
      // picked by the bottle (cracking the case) instead of pulling the whole
      // case. Zoho lines carry a unit ('Case'/'Cases'/'Bottle') and a pack
      // description ('1x75cl', '6x75cl'). The ordered pack is the bottles per
      // ordered "case"; the stock pack is how the wine is physically cased.
      const isBottleUnit = /^bottle/i.test((item.unit ?? '').trim());
      const packMatch = /^(\d+)\s*[x×]/i.exec(item.description ?? '');
      const orderedPack =
        packMatch && Number(packMatch[1]) > 0 ? Number(packMatch[1]) : 1;
      const stockPack =
        availableStock[0]?.caseConfig && availableStock[0].caseConfig > 0
          ? availableStock[0].caseConfig
          : orderedPack;
      // True bottle count the customer ordered.
      const orderedBottles = isBottleUnit
        ? item.quantity
        : orderedPack * item.quantity;
      // Whole-case pick ONLY when full cases of the same pack the stock is held
      // in were ordered. Otherwise pick by the bottle — the pick engine cracks
      // the larger case at pick time (e.g. 1x75cl ordered from a 6-pack).
      const wholeCase = !isBottleUnit && orderedPack === stockPack;
      const quantityBottles = wholeCase ? null : orderedBottles;
      const casesNeeded = wholeCase
        ? item.quantity
        : Math.max(1, Math.ceil(orderedBottles / stockPack));

      // Find first location with enough stock (in cases)
      const suggestedStock = availableStock.find(
        (s) => s.availableCases >= casesNeeded,
      ) ?? availableStock[0]; // Fall back to any available stock if none has enough

      if (!suggestedStock) {
        unresolvedItems.push(item.name);
      }

      const [pickListItem] = await db
        .insert(wmsPickListItems)
        .values({
          pickListId: pickList.id,
          // Only store an authoritative LWIN: the matched stock's LWIN, or the
          // normalized order LWIN. Never store the raw Zoho SKU — an unmatched
          // SKU produces a pick line that can't be found and fails cryptically
          // on the warehouse floor.
          lwin18: suggestedStock?.lwin18 ?? itemLwin18 ?? '',
          productName: item.name,
          quantityCases: casesNeeded,
          quantityBottles,
          suggestedLocationId: suggestedStock?.locationId ?? null,
          suggestedStockId: suggestedStock?.stockId ?? null,
          notes: suggestedStock
            ? null
            : 'UNRESOLVED: no matching stock found at release — check the wine/vintage before picking',
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
      unresolvedItems,
      message:
        unresolvedItems.length > 0
          ? `Released to pick: ${pickListNumber} with ${pickListItems.length} items — ${unresolvedItems.length} could not be matched to stock and need checking: ${unresolvedItems.join(', ')}`
          : `Released to pick: ${pickListNumber} with ${pickListItems.length} items`,
    };
  });

export default adminReleaseToPick;
