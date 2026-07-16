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
  wmsStock,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

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

    // Cases already picked per LWIN, so we only regenerate the remainder.
    const pickedCasesByLwin = new Map<string, number>();
    for (const p of pickedItems) {
      pickedCasesByLwin.set(
        p.lwin18,
        (pickedCasesByLwin.get(p.lwin18) ?? 0) +
          (p.pickedQuantity ?? p.quantityCases),
      );
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

        const alreadyPicked = pickedCasesByLwin.get(resolvedLwin18) ?? 0;
        const remaining = item.quantity - alreadyPicked;
        if (remaining <= 0) continue;

        const availableStock = resolvedLwin18
          ? await tx
              .select({
                stockId: wmsStock.id,
                locationId: wmsStock.locationId,
                availableCases: wmsStock.availableCases,
                lwin18: wmsStock.lwin18,
              })
              .from(wmsStock)
              .where(eq(wmsStock.lwin18, resolvedLwin18))
              .orderBy(wmsStock.availableCases)
          : [];

        const suggestedStock =
          availableStock.find((s) => s.availableCases >= remaining) ??
          availableStock[0];

        await tx.insert(wmsPickListItems).values({
          pickListId,
          lwin18: suggestedStock?.lwin18 ?? resolvedLwin18,
          productName: item.name,
          quantityCases: remaining,
          suggestedLocationId: suggestedStock?.locationId ?? null,
          suggestedStockId: suggestedStock?.stockId ?? null,
          notes: suggestedStock
            ? null
            : 'UNRESOLVED: no matching stock at re-sync — check wine/vintage',
        });
        added++;
      }

      // Flag any already-picked line the order no longer contains.
      let orphanedPicked = 0;
      for (const p of pickedItems) {
        if (!orderLwins.has(p.lwin18)) {
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
