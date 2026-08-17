/**
 * Re-sync a pick list to its Zoho sales order
 *
 * When a released order is edited in Zoho (`soModifiedAfterRelease`), the pick
 * list snapshot goes stale. This rebuilds the UNPICKED portion of the pick to
 * match the current order — preserving every line already picked — then clears
 * the order's modified flag. A line already picked but since removed from the
 * order is kept and flagged for a supervisor to verify rather than deleted.
 */

import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  wmsPickListItems,
  wmsPickLists,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import parseSkuPack from '../utils/parseSkuPack';
import resolvePickQuantities from '../utils/resolvePickQuantities';
import resolvePickStock from '../utils/resolvePickStock';

/**
 * Convert a raw 18-digit SKU to dashed LWIN18, matching pick-list creation.
 *
 * @example
 *   formatSkuAsLwin18('100805220210600750') // '1008052-2021-06-00750'
 */
const formatSkuAsLwin18 = (sku: string) => {
  const digits = sku.replace(/\D/g, '');
  if (digits.length !== 18) return sku;
  return `${digits.slice(0, 7)}-${digits.slice(7, 11)}-${digits.slice(11, 13)}-${digits.slice(13)}`;
};

const adminResyncPickList = wmsOperatorProcedure
  .input(z.object({ pickListId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const { pickListId } = input;

    const [pickList] = await db
      .select()
      .from(wmsPickLists)
      .where(eq(wmsPickLists.id, pickListId));

    if (!pickList) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Pick list not found' });
    }

    const [order] = await db
      .select()
      .from(zohoSalesOrders)
      .where(eq(zohoSalesOrders.id, pickList.orderId));

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Linked sales order not found',
      });
    }

    // NOTE: the caller is responsible for refreshing the order from Zoho first
    // (a forced `zohoSalesOrders.sync`). An item-master edit — correcting a
    // SKU's pack digits from `06` to `01` — does not bump the sales order's
    // last-modified time, so without that forced pass this rebuilds faithfully
    // from stale lines and the operator hits the same "no stock found" wall.
    const orderItems = await db
      .select()
      .from(zohoSalesOrderItems)
      .where(eq(zohoSalesOrderItems.salesOrderId, order.id));

    const existingItems = await db
      .select()
      .from(wmsPickListItems)
      .where(eq(wmsPickListItems.pickListId, pickListId));

    // Preserve every line with physical progress; the rest is regenerated.
    const pickedItems = existingItems.filter(
      (i) => i.isPicked || (i.pickedQuantity ?? 0) > 0,
    );
    const unpickedItems = existingItems.filter(
      (i) => !i.isPicked && (i.pickedQuantity ?? 0) === 0,
    );

    // Bottles already picked per WINE — keyed pack-agnostically and counted in
    // bottles, because neither the code nor the unit is stable across a rebuild.
    // A bottle picked from a 6-pack is recorded against `…-06-…`, while the
    // rebuilt line resolves to the singles row `…-01-…`; keying on the exact
    // code made the two look like different wines and the line was added again,
    // so an operator saw every remaining wine twice.
    const wineKey = (lwin18: string | null | undefined) => {
      const parts = String(lwin18 ?? '').split('-');
      return parts.length === 4
        ? `${parts[0]}-${parts[1]}-${parts[3]}`
        : String(lwin18 ?? '');
    };
    const packOfCode = (lwin18: string | null | undefined) =>
      parseSkuPack(lwin18)?.pack ?? 1;

    const pickedBottlesByWine = new Map<string, number>();
    for (const p of pickedItems) {
      // A bottle pick records bottles in pickedQuantity; a case pick records
      // cases, which are worth `pack` bottles each.
      const bottles =
        p.quantityBottles != null
          ? (p.pickedQuantity ?? p.quantityBottles)
          : (p.pickedQuantity ?? p.quantityCases) * packOfCode(p.lwin18);
      const key = wineKey(p.lwin18);
      pickedBottlesByWine.set(key, (pickedBottlesByWine.get(key) ?? 0) + bottles);
    }

    const result = await db.transaction(async (tx) => {
      // Drop all unpicked lines — they are rebuilt from the live order below.
      if (unpickedItems.length > 0) {
        await tx
          .delete(wmsPickListItems)
          .where(
            and(
              eq(wmsPickListItems.pickListId, pickListId),
              eq(wmsPickListItems.isPicked, false),
            ),
          );
      }

      let added = 0;
      const orderLwins = new Set<string>();

      for (const item of orderItems) {
        const resolvedLwin18 = item.lwin18
          ? item.lwin18
          : item.sku
            ? formatSkuAsLwin18(item.sku)
            : '';
        orderLwins.add(resolvedLwin18);

        // Compare like with like: everything in bottles, then back to the
        // ordered pack for the line we write.
        const orderedPack =
          parseSkuPack(item.sku ?? resolvedLwin18)?.pack ??
          (Number(/^(\d+)\s*[x×]/i.exec(item.description ?? '')?.[1]) || 1);
        const orderedBottles = item.quantity * orderedPack;
        const alreadyPicked = pickedBottlesByWine.get(wineKey(resolvedLwin18)) ?? 0;
        const remainingBottles = orderedBottles - alreadyPicked;
        if (remainingBottles <= 0) continue;
        const remaining = Math.ceil(remainingBottles / orderedPack);

        // Pack-agnostic, in-stock-only match by LWIN7+vintage (safe name
        // fallback) — never pins an empty pack or a lookalike cuvée.
        const suggestedStock = await resolvePickStock({
          lwin18: resolvedLwin18,
          productName: item.name,
          neededCases: remaining,
          db: tx,
        });

        const quantities = resolvePickQuantities({
          quantity: remaining,
          unit: item.unit,
          description: item.description,
          sku: item.sku ?? resolvedLwin18,
          stockCaseConfig: suggestedStock?.caseConfig,
        });

        await tx.insert(wmsPickListItems).values({
          pickListId,
          lwin18: suggestedStock?.lwin18 ?? resolvedLwin18,
          productName: item.name,
          quantityCases: quantities.casesNeeded,
          quantityBottles: quantities.quantityBottles,
          suggestedLocationId: suggestedStock?.locationId ?? null,
          suggestedStockId: suggestedStock?.stockId ?? null,
          notes: suggestedStock
            ? suggestedStock.matchedBy === 'name'
              ? 'VERIFY: matched by name (no LWIN match) — confirm the wine'
              : null
            : 'UNRESOLVED: no matching stock at re-sync — check wine/vintage',
        });
        added++;
      }

      // Flag any already-picked line the order no longer contains.
      let orphanedPicked = 0;
      const orderWines = new Set([...orderLwins].map(wineKey));
      for (const p of pickedItems) {
        if (!orderWines.has(wineKey(p.lwin18))) {
          await tx
            .update(wmsPickListItems)
            .set({
              notes:
                'REVIEW: line removed from the order in Zoho after it was picked',
              updatedAt: new Date(),
            })
            .where(eq(wmsPickListItems.id, p.id));
          orphanedPicked++;
        }
      }

      // Refresh pick-list totals and clear the order's modified flag.
      const finalItems = await tx
        .select({ id: wmsPickListItems.id })
        .from(wmsPickListItems)
        .where(eq(wmsPickListItems.pickListId, pickListId));

      await tx
        .update(wmsPickLists)
        .set({ totalItems: finalItems.length, updatedAt: new Date() })
        .where(eq(wmsPickLists.id, pickListId));

      await tx
        .update(zohoSalesOrders)
        .set({
          soModifiedAfterRelease: false,
          soModifiedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(zohoSalesOrders.id, order.id));

      return {
        added,
        preservedPicked: pickedItems.length,
        removedUnpicked: unpickedItems.length,
        orphanedPicked,
      };
    });

    return {
      success: true,
      ...result,
      message: `Pick list re-synced — ${result.added} line(s) regenerated, ${result.preservedPicked} already-picked line(s) preserved`,
    };
  });

export default adminResyncPickList;
