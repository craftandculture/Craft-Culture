import { and, eq, inArray, sql } from 'drizzle-orm';

import {
  wmsStock,
  wmsStockReservations,
  zohoSalesOrderItems,
} from '@/database/schema';

interface ZohoLineItem {
  line_item_id: string;
  item_id?: string | null;
  sku?: string | null;
  name: string;
  description?: string | null;
  rate: number;
  quantity: number;
  unit?: string | null;
  discount?: number | null;
  item_total: number;
}

interface LocalItem {
  id: string;
  zohoLineItemId: string;
  quantity: number;
  name: string;
  rate: number;
  itemTotal: number;
}

interface ReconcileParams {
  orderId: string;
  zohoLineItems: ZohoLineItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

/**
 * Reconcile a Zoho sales order's local line items to match Zoho exactly.
 *
 * Adds new lines, updates changed quantity/price/name, and — crucially —
 * DELETES lines that were removed in Zoho (releasing any active stock
 * reservation first) so the warehouse never picks a line that no longer
 * exists on the order. Runs in a transaction. Should only be called for
 * orders still in `synced` status (not yet released to pick).
 *
 * @example
 *   await reconcileZohoSalesOrderItems({
 *     orderId,
 *     zohoLineItems: fullOrder.line_items,
 *     db: triggerDb,
 *   });
 *
 * @param orderId - The local zohoSalesOrders.id
 * @param zohoLineItems - The current line items from Zoho (the source of truth)
 * @param db - Drizzle db handle
 * @returns Counts of line items added, updated and removed
 */
const reconcileZohoSalesOrderItems = async ({
  orderId,
  zohoLineItems,
  db,
}: ReconcileParams) => {
  // Safety guard: never reconcile against an empty set — this protects against
  // a bad or partial Zoho response wiping every line. Removing SOME lines from
  // an order still returns >= 1 line item, so the common case is covered.
  if (!Array.isArray(zohoLineItems) || zohoLineItems.length === 0) {
    return { added: 0, updated: 0, removed: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.transaction(async (tx: any) => {
    const existing: LocalItem[] = await tx
      .select({
        id: zohoSalesOrderItems.id,
        zohoLineItemId: zohoSalesOrderItems.zohoLineItemId,
        quantity: zohoSalesOrderItems.quantity,
        name: zohoSalesOrderItems.name,
        rate: zohoSalesOrderItems.rate,
        itemTotal: zohoSalesOrderItems.itemTotal,
      })
      .from(zohoSalesOrderItems)
      .where(eq(zohoSalesOrderItems.salesOrderId, orderId));

    const zohoIds = new Set(zohoLineItems.map((i) => i.line_item_id));
    const existingByZohoId = new Map(existing.map((e) => [e.zohoLineItemId, e]));

    const removed = existing.filter((e) => !zohoIds.has(e.zohoLineItemId));
    const added = zohoLineItems.filter(
      (i) => !existingByZohoId.has(i.line_item_id),
    );

    const changed: { zoho: ZohoLineItem; localId: string }[] = [];
    for (const item of zohoLineItems) {
      const local = existingByZohoId.get(item.line_item_id);
      if (
        local &&
        (local.quantity !== item.quantity ||
          local.rate !== item.rate ||
          local.name !== item.name ||
          local.itemTotal !== item.item_total)
      ) {
        changed.push({ zoho: item, localId: local.id });
      }
    }

    // Release any active reservations for lines being removed or changed so the
    // held cases return to availableCases (mirrors releaseStockReservations).
    const affectedItemIds = [
      ...removed.map((r) => r.id),
      ...changed.map((c) => c.localId),
    ];

    if (affectedItemIds.length > 0) {
      const activeReservations = await tx
        .select({
          id: wmsStockReservations.id,
          stockId: wmsStockReservations.stockId,
          quantityCases: wmsStockReservations.quantityCases,
        })
        .from(wmsStockReservations)
        .where(
          and(
            inArray(wmsStockReservations.orderItemId, affectedItemIds),
            eq(wmsStockReservations.status, 'active'),
          ),
        );

      const now = new Date();
      for (const reservation of activeReservations) {
        await tx
          .update(wmsStock)
          .set({
            reservedCases: sql`${wmsStock.reservedCases} - ${reservation.quantityCases}`,
            availableCases: sql`${wmsStock.availableCases} + ${reservation.quantityCases}`,
            updatedAt: now,
          })
          .where(eq(wmsStock.id, reservation.stockId));

        await tx
          .update(wmsStockReservations)
          .set({
            status: 'released' as const,
            releasedAt: now,
            releaseReason: 'Line removed or changed in Zoho sync',
            updatedAt: now,
          })
          .where(eq(wmsStockReservations.id, reservation.id));
      }
    }

    // Delete lines that were removed in Zoho
    if (removed.length > 0) {
      await tx.delete(zohoSalesOrderItems).where(
        inArray(
          zohoSalesOrderItems.id,
          removed.map((r) => r.id),
        ),
      );
    }

    // Update lines whose quantity / price / name changed; clear the stale stock
    // match so release-to-pick re-resolves it against current inventory.
    for (const { zoho, localId } of changed) {
      await tx
        .update(zohoSalesOrderItems)
        .set({
          name: zoho.name,
          description: zoho.description,
          rate: zoho.rate,
          quantity: zoho.quantity,
          unit: zoho.unit,
          discount: zoho.discount,
          itemTotal: zoho.item_total,
          stockId: null,
          updatedAt: new Date(),
        })
        .where(eq(zohoSalesOrderItems.id, localId));
    }

    // Insert lines newly added in Zoho
    if (added.length > 0) {
      await tx.insert(zohoSalesOrderItems).values(
        added.map((item) => ({
          salesOrderId: orderId,
          zohoLineItemId: item.line_item_id,
          zohoItemId: item.item_id,
          sku: item.sku,
          name: item.name,
          description: item.description,
          rate: item.rate,
          quantity: item.quantity,
          unit: item.unit,
          discount: item.discount,
          itemTotal: item.item_total,
        })),
      );
    }

    return {
      added: added.length,
      updated: changed.length,
      removed: removed.length,
    };
  });
};

export default reconcileZohoSalesOrderItems;
