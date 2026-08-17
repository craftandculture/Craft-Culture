/**
 * Release Zoho Sales Order to Pick
 *
 * Directly creates a pick list for an invoiced Zoho sales order.
 * Skips the 'approved' state - goes directly from 'synced' to 'picking'.
 * Only works for orders with zohoStatus === 'invoiced' (finalized in Zoho).
 */

import { TRPCError } from '@trpc/server';
import { and, eq, gt, ilike, like, or } from 'drizzle-orm';
import { z } from 'zod';

import generatePickListNumber from '@/app/_wms/utils/generatePickListNumber';
import lwinPackAgnosticPattern from '@/app/_wms/utils/lwinPackAgnosticPattern';
import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import rankStockByPack from '@/app/_wms/utils/rankStockByPack';
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
        quantityCases: number;
        lwin18: string;
        productName: string;
        caseConfig: number | null;
      }[] = [];

      const stockSelect = {
        stockId: wmsStock.id,
        locationId: wmsStock.locationId,
        locationCode: wmsLocations.locationCode,
        availableCases: wmsStock.availableCases,
        quantityCases: wmsStock.quantityCases,
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
              or(gt(wmsStock.quantityCases, 0), gt(wmsStock.openBottles, 0)),
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
            .where(
              and(
                eq(wmsStock.lwin18, code),
                or(gt(wmsStock.quantityCases, 0), gt(wmsStock.openBottles, 0)),
              ),
            )
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
          .replace(/_/g, ' ')
          .replace(
            /\(\s*(?:single bottle|\d+\s*(?:x|pack|packs|bottles?|btl))\s*\)/gi,
            ' ',
          )
          .split(/[\s,\-]+/)
          .filter((word) => word.length > 2 && !/^(19|20)\d{2}$/.test(word))
          .slice(0, 8); // Use up to 8 significant words for better disambiguation

        if (searchTerms.length > 0) {
          // Build AND conditions — all terms must appear in product name. A
          // non-ASCII char becomes a wildcard so `François` on the order still
          // matches `Francois` in stock.
          const conditions = searchTerms.map((term) =>
            ilike(
              wmsStock.productName,
              `%${term.replace(/[^\x20-\x7E]/g, '%')}%`,
            ),
          );

          availableStock = await db
            .select({
              stockId: wmsStock.id,
              locationId: wmsStock.locationId,
              locationCode: wmsLocations.locationCode,
              availableCases: wmsStock.availableCases,
              quantityCases: wmsStock.quantityCases,
              lwin18: wmsStock.lwin18,
              productName: wmsStock.productName,
              caseConfig: wmsStock.caseConfig,
            })
            .from(wmsStock)
            .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
            .where(
              and(
                ...conditions,
                or(gt(wmsStock.quantityCases, 0), gt(wmsStock.openBottles, 0)),
              ),
            )
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

      // Rank the candidate bays by pack fit — shared with the pick-list screen's
      // preview so the bay an operator was shown is the bay they're sent to.
      const packOf = (caseConfig: number | null) =>
        caseConfig && caseConfig > 0 ? caseConfig : orderedPack;
      availableStock = rankStockByPack(availableStock, orderedPack);

      // Prefer a bay with enough UNRESERVED stock; fall back to one that
      // physically holds the wine. Gating the search on availableCases meant a
      // fully-reserved wine looked like no stock at all — including stock
      // reserved for THIS order at approval — and the line was released with no
      // bay and no LWIN, which is what strands an operator at the shelf.
      const suggestedStock =
        availableStock.find(
          (s) => s.availableCases >= casesNeededFor(packOf(s.caseConfig)),
        ) ??
        availableStock.find(
          (s) => s.quantityCases >= casesNeededFor(packOf(s.caseConfig)),
        ) ??
        availableStock[0];

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
          // Prefer the matched stock's LWIN, then the order's own lwin18
          // column, then the SKU normalised to LWIN18 shape. That last fallback
          // matters: zohoSalesOrderItems.lwin18 is usually null (the code lives
          // in `sku`), so without it an unmatched line was released with an
          // EMPTY code — and an empty code can never find stock at the bay,
          // which reads on the scanner as "No stock found at this location".
          lwin18:
            suggestedStock?.lwin18 ??
            itemLwin18 ??
            (item.sku ? normalizeLwin18(item.sku) : ''),
          productName: item.name,
          quantityCases: casesNeeded,
          quantityBottles,
          suggestedLocationId: suggestedStock?.locationId ?? null,
          suggestedStockId: suggestedStock?.stockId ?? null,
          notes: !suggestedStock
            ? 'UNRESOLVED: no matching stock found at release — check the wine/vintage before picking'
            : suggestedStock.availableCases < casesNeeded
              ? `RESERVED: ${suggestedStock.locationCode} physically holds this wine but it is reserved for another order — confirm before picking`
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
