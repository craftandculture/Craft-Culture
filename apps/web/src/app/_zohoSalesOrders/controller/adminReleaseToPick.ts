/**
 * Release Zoho Sales Order to Pick
 *
 * Directly creates a pick list for an invoiced Zoho sales order.
 * Skips the 'approved' state - goes directly from 'synced' to 'picking'.
 * Only works for orders with zohoStatus === 'invoiced' (finalized in Zoho).
 */

import { TRPCError } from '@trpc/server';
import { and, eq, gt, ilike, like } from 'drizzle-orm';
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

/**
 * A pack-agnostic LIKE pattern for a dashed LWIN18 — same wine, same vintage,
 * same bottle size, ANY pack (`1109704-2008-%-00750`). Returns null when the
 * code isn't in `LWIN7-VVVV-PP-SSSSS` shape.
 *
 * A 3-pack invoiced off a 6-pack on the shelf (`…-03-…` vs `…-06-…`) is the
 * same wine in the same bay — just a case that gets broken at pick time — so
 * the bay lookup must ignore the pack segment. The bottle size is deliberately
 * kept: a magnum is a different physical thing, not a repack.
 *
 * @example
 *   lwinPackAgnosticPattern('1109704-2008-03-00750'); // '1109704-2008-%-00750'
 */
const lwinPackAgnosticPattern = (lwin18: string | null | undefined) => {
  if (!lwin18) return null;
  const parts = lwin18.split('-');
  if (parts.length !== 4) return null;
  const [wine, vintage, , size] = parts;
  return wine && vintage && size ? `${wine}-${vintage}-%-${size}` : null;
};

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

      const stockSelect = {
        stockId: wmsStock.id,
        locationId: wmsStock.locationId,
        locationCode: wmsLocations.locationCode,
        availableCases: wmsStock.availableCases,
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        caseConfig: wmsStock.caseConfig,
      };

      // Strategy 1: Match by LWIN18, PACK-AGNOSTIC — the ordered pack and the
      // pack the wine is physically cased in are allowed to differ (invoice a
      // 3-pack, hold a 6-pack: same wine, same bay, broken at pick time). An
      // exact-pack match is ranked first below, so this only widens the net.
      const packPattern =
        lwinPackAgnosticPattern(itemLwin18) ??
        lwinPackAgnosticPattern(item.sku ? normalizeLwin18(item.sku) : null);

      if (packPattern) {
        availableStock = await db
          .select(stockSelect)
          .from(wmsStock)
          .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
          .where(
            and(
              like(wmsStock.lwin18, packPattern),
              gt(wmsStock.availableCases, 0),
            ),
          )
          .orderBy(wmsStock.availableCases);
      }

      // Strategy 2: Exact LWIN18 for codes that aren't in LWIN7-VVVV-PP-SSSSS
      // shape (supplier codes, mis-dashed values) — no pattern to widen on.
      if (availableStock.length === 0 && !packPattern) {
        const exactCodes = [
          itemLwin18,
          item.sku ? normalizeLwin18(item.sku) : null,
        ].filter((code): code is string => !!code);

        for (const code of exactCodes) {
          availableStock = await db
            .select(stockSelect)
            .from(wmsStock)
            .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
            .where(and(eq(wmsStock.lwin18, code), gt(wmsStock.availableCases, 0)))
            .orderBy(wmsStock.availableCases);
          if (availableStock.length > 0) break;
        }
      }

      // Strategy 3: Match by product name (case-insensitive, ALL terms must match)
      if (availableStock.length === 0 && item.name) {
        // Extract key words from product name for matching. Exclude vintage
        // years (e.g. "2022") — WMS stock product names don't carry the
        // vintage (it lives in a separate column), so requiring the year to
        // appear in the name would make every match fail. Pack suffixes Zoho
        // carries in the name ("(3 pack)", "(6x)", "(single bottle)") aren't in
        // the stock name either, so they're stripped rather than required.
        const searchTerms = item.name
          .replace(
            /\(\s*(?:single bottle|\d+\s*(?:x|pack|packs|bottles?|btl))\s*\)/gi,
            ' ',
          )
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
      // True bottle count the customer ordered.
      const orderedBottles = isBottleUnit
        ? item.quantity
        : orderedPack * item.quantity;

      // Cases to pull from a bay holding this pack. A whole-case pick ONLY when
      // full cases of the pack the stock is held in were ordered; otherwise the
      // pick engine cracks the case at pick time (e.g. a 3x75cl off a 6-pack).
      const casesNeededFor = (pack: number) =>
        !isBottleUnit && pack === orderedPack
          ? item.quantity
          : Math.max(1, Math.ceil(orderedBottles / pack));

      // Rank the candidate bays: the exact ordered pack first (no repack), then
      // the smallest larger pack that can be broken down, then smaller packs to
      // combine. Ties keep the DB order (least available first) so a part-empty
      // bay is drained before a full one.
      const packOf = (caseConfig: number | null) =>
        caseConfig && caseConfig > 0 ? caseConfig : orderedPack;
      const rankOf = (caseConfig: number | null) => {
        const pack = packOf(caseConfig);
        if (pack === orderedPack) return 0;
        return pack > orderedPack ? 1 : 2;
      };
      availableStock = [...availableStock].sort((a, b) => {
        const rankDiff = rankOf(a.caseConfig) - rankOf(b.caseConfig);
        if (rankDiff !== 0) return rankDiff;
        return (
          Math.abs(packOf(a.caseConfig) - orderedPack) -
          Math.abs(packOf(b.caseConfig) - orderedPack)
        );
      });

      // Find first location with enough stock (in cases of ITS pack)
      const suggestedStock =
        availableStock.find(
          (s) => s.availableCases >= casesNeededFor(packOf(s.caseConfig)),
        ) ?? availableStock[0]; // Fall back to any available stock if none has enough

      const stockPack = packOf(suggestedStock?.caseConfig ?? null);
      const wholeCase = !isBottleUnit && orderedPack === stockPack;
      const quantityBottles = wholeCase ? null : orderedBottles;
      const casesNeeded = casesNeededFor(stockPack);

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
