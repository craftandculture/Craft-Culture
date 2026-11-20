import { and, inArray, isNull, lt, or } from 'drizzle-orm';

import holdStockForSalesOrder from '@/app/_wms/utils/holdStockForSalesOrder';
import syncExistingSalesOrder from '@/app/_wms/utils/syncExistingSalesOrder';
import { adoptDraftHolds, refreshAllDraftHolds } from '@/app/_zohoSalesOrders/data/draftHolds';
import linkSalesOrdersToPcos from '@/app/_zohoSalesOrders/data/linkSalesOrdersToPcos';
import releaseClosedOrderHolds from '@/app/_zohoSalesOrders/data/releaseClosedOrderHolds';
import isSalesOrderUnchanged from '@/app/_zohoSalesOrders/utils/isSalesOrderUnchanged';
import pickInvoiceNumber from '@/app/_zohoSalesOrders/utils/pickInvoiceNumber';
import db from '@/database/client';
import { zohoSalesOrderItems, zohoSalesOrders } from '@/database/schema';
import discountAmount from '@/lib/zoho/discountAmount';
import {
  getSalesOrder,
  listAllSalesOrdersByStatus,
  listRecentSalesOrdersByStatus,
} from '@/lib/zoho/salesOrders';
import type { ZohoSalesOrder } from '@/lib/zoho/types';
import logger from '@/utils/logger';

import refreshNamedSalesOrders from './refreshNamedSalesOrders';

/**
 * Orders we hold as invoiced that a recent-only listing could not have shown
 *
 * They are not missing from Zoho, only from the window, so the closed-order
 * step must not spend its Zoho checks on them. One voided in Zoho after it was
 * invoiced is still caught by the hourly full sweep, which passes no window.
 *
 * @param since - The listing's window start; none means a full listing
 * @returns Their Zoho ids
 */
const invoicedOutsideWindow = async (since: Date | undefined) => {
  if (!since) return [];

  const rows: { zohoSalesOrderId: string }[] = await db
    .select({ zohoSalesOrderId: zohoSalesOrders.zohoSalesOrderId })
    .from(zohoSalesOrders)
    .where(
      and(
        inArray(zohoSalesOrders.zohoStatus, ['invoiced', 'partially_invoiced']),
        or(
          isNull(zohoSalesOrders.zohoLastModifiedTime),
          lt(zohoSalesOrders.zohoLastModifiedTime, since),
        ),
      ),
    );

  return rows.map((row) => row.zohoSalesOrderId);
};

/**
 * Bring Zoho's open and invoiced sales orders into the warehouse
 *
 * One definition for the Sync Orders button and the scheduled sync. They were
 * two copies — the button here, the job on Trigger.dev — and when Trigger.dev
 * was switched off in October 2026 the schedule moved to a Vercel cron that
 * calls this, so there is now one. New orders are created and their stock
 * held; existing ones are reconciled; held drafts follow their Zoho draft;
 * stock held for orders voided in Zoho is released; and each order is linked
 * to the PCO it fulfils.
 *
 * The caller checks Zoho is configured.
 *
 * @example
 *   const result = await syncSalesOrdersFromZoho();
 *   result.message; // 'Synced 2 new, 5 updated from 41 orders'
 *
 * @param options.forceRefreshOrderNumbers - Re-fetch these even when Zoho reports them unchanged
 * Existing orders are loaded in one query and compared in memory; only orders
 * Zoho reports as changed (see isSalesOrderUnchanged), or forced, go through
 * syncExistingSalesOrder.
 *
 * @param options.forceRefreshOrderNumbers - Re-fetch these even when Zoho reports them unchanged
 * @param options.onlyTheseOrders - Refresh only the named orders and skip the sweep (see refreshNamedSalesOrders)
 * @param options.invoicedModifiedSince - List only invoiced and partly invoiced
 *   orders Zoho modified since this time (the scheduled sync between its hourly
 *   full sweeps). Omitted, every one is listed, as the Sync Orders button does.
 * @returns Counts, failures and a one-line summary
 */
const syncSalesOrdersFromZoho = async ({
  forceRefreshOrderNumbers = [],
  onlyTheseOrders = false,
  invoicedModifiedSince,
}: {
  forceRefreshOrderNumbers?: string[];
  onlyTheseOrders?: boolean;
  invoicedModifiedSince?: Date;
} = {}) => {
  if (onlyTheseOrders && forceRefreshOrderNumbers.length > 0) {
    return refreshNamedSalesOrders(forceRefreshOrderNumbers);
  }

  const startedAt = Date.now();
  const forceOrderNumbers = new Set(forceRefreshOrderNumbers);

  const results = {
    fetched: 0,
    created: 0,
    updated: 0,
    errors: 0,
  };
  // Which orders failed and why — reported back to the screen, since an order
  // that fails to sync otherwise just never appears.
  const failed: { salesOrderNumber: string; reason: string }[] = [];
  /** New orders that asked for more than the warehouse has free */
  const shortOnSync: string[] = [];

  /*
    Open orders are always listed in full. The invoiced set only grows, so the
    scheduled sync lists just the recently modified ones between its hourly
    full sweeps (see isFullSweepSlot).
  */
  const listInvoicedStatus = (status: ZohoSalesOrder['status']) =>
    invoicedModifiedSince
      ? listRecentSalesOrdersByStatus(status, invoicedModifiedSince)
      : listAllSalesOrdersByStatus(status);

  // Fetch the sales orders from Zoho that need fulfillment (paginated)
  const [openOrders, invoicedOrders, partlyInvoicedOrders] = await Promise.all([
    listAllSalesOrdersByStatus('open'),
    listInvoicedStatus('invoiced'),
    /*
      Partly invoiced orders are pickable (isPickableZohoStatus) but were never
      listed, so they were never refreshed, and the closed-order step saw them
      as missing and spent its Zoho checks on them. Caught on its own so that,
      should Zoho refuse this status filter, the open and invoiced sync still runs.
    */
    listInvoicedStatus('partially_invoiced').catch((error) => {
      console.error('Failed to list partially invoiced sales orders', { error });
      return [];
    }),
  ]);

  /*
    One entry per order. A listing paged while an order is being edited can
    return it twice; the newest copy wins, so a second pass cannot try to
    insert an order the first pass just created.
  */
  const byZohoId = new Map<string, ZohoSalesOrder>();
  for (const order of [...openOrders, ...invoicedOrders, ...partlyInvoicedOrders]) {
    const seen = byZohoId.get(order.salesorder_id);
    if (
      !seen ||
      new Date(order.last_modified_time).getTime() >
        new Date(seen.last_modified_time).getTime()
    ) {
      byZohoId.set(order.salesorder_id, order);
    }
  }
  const salesOrders = [...byZohoId.values()];

  results.fetched = salesOrders.length;

  /*
    Every listed order we already hold, in one query, with what the
    unchanged check needs. It used to be two selects per order, one here and
    one inside syncExistingSalesOrder, before an idle order was skipped.
  */
  const existingRows: {
    id: string;
    zohoSalesOrderId: string;
    status: string | null;
    zohoStatus: string | null;
    zohoLastModifiedTime: Date | null;
  }[] = salesOrders.length
    ? await db
        .select({
          id: zohoSalesOrders.id,
          zohoSalesOrderId: zohoSalesOrders.zohoSalesOrderId,
          status: zohoSalesOrders.status,
          zohoStatus: zohoSalesOrders.zohoStatus,
          zohoLastModifiedTime: zohoSalesOrders.zohoLastModifiedTime,
        })
        .from(zohoSalesOrders)
        .where(inArray(zohoSalesOrders.zohoSalesOrderId, [...byZohoId.keys()]))
    : [];
  const existingByZohoId = new Map(existingRows.map((row) => [row.zohoSalesOrderId, row]));

  let changed = 0;
  let skipped = 0;

  for (const zohoOrder of salesOrders) {
    try {
      const existing = existingByZohoId.get(zohoOrder.salesorder_id);

      if (existing) {
        const force = forceOrderNumbers.has(zohoOrder.salesorder_number);

        // Nothing new in Zoho: syncExistingSalesOrder would return
        // 'unchanged' (or 'skipped') without touching anything
        if (isSalesOrderUnchanged({ stored: existing, zohoOrder, force })) {
          skipped++;
          continue;
        }

        changed++;

        // Route through the shared helper so this button and the scheduled job
        // stay identical. Previously this path was insert-only and silently
        // dropped quantity edits (the SO-00099 Talbot bug).
        const syncResult = await syncExistingSalesOrder({
          existing: { id: existing.id, status: existing.status },
          current: {
            zohoStatus: existing.zohoStatus,
            zohoLastModifiedTime: existing.zohoLastModifiedTime,
          },
          zohoOrder,
          db,
          force,
        });

        if (
          syncResult.outcome === 'reconciled' ||
          syncResult.outcome === 'flagged'
        ) {
          results.updated++;
        }
        continue;
      }

      changed++;

      // Fetch full order details with line items
      const fullOrder = await getSalesOrder(zohoOrder.salesorder_id);

      // Create order + line items in a transaction to prevent orphaned records
      const newOrderId = await db.transaction(async (tx) => {
        const [newOrder] = await tx
          .insert(zohoSalesOrders)
          .values({
            zohoSalesOrderId: fullOrder.salesorder_id,
            salesOrderNumber: fullOrder.salesorder_number,
            zohoCustomerId: fullOrder.customer_id,
            customerName: fullOrder.customer_name,
            zohoStatus: fullOrder.status,
            status: 'synced',
            orderDate: new Date(fullOrder.date),
            shipmentDate: fullOrder.shipment_date
              ? new Date(fullOrder.shipment_date)
              : null,
            referenceNumber: fullOrder.reference_number,
            subTotal: fullOrder.sub_total,
            total: fullOrder.total,
            currencyCode: fullOrder.currency_code,
            shippingCharge: fullOrder.shipping_charge,
            discount: discountAmount(fullOrder.discount, fullOrder.discount_amount),
            notes: fullOrder.notes,
            billingAddress: fullOrder.billing_address,
            shippingAddress: fullOrder.shipping_address,
            zohoCreatedTime: new Date(fullOrder.created_time),
            // Left empty until the stock is held (below), so a failed hold
            // is retried by the next sync instead of being skipped as unchanged
            zohoLastModifiedTime: null,
            // Straight off the order — see pickInvoiceNumber for why the
            // reference_number match isn't enough on its own.
            invoiceNumber: pickInvoiceNumber(fullOrder),
            lastSyncAt: new Date(),
          })
          .returning({ id: zohoSalesOrders.id });

      if (!newOrder) throw new Error(`Could not save ${fullOrder.salesorder_number}`);

        if (fullOrder.line_items && fullOrder.line_items.length > 0) {
          await tx.insert(zohoSalesOrderItems).values(
            fullOrder.line_items.map((item) => ({
              salesOrderId: newOrder.id,
              zohoLineItemId: item.line_item_id,
              zohoItemId: item.item_id,
              sku: item.sku,
              name: item.name,
              description: item.description,
              rate: item.rate,
              quantity: item.quantity,
              unit: item.unit,
              discount: discountAmount(item.discount, item.discount_amount),
              itemTotal: item.item_total,
            })),
          );
        }

        return newOrder.id;
      });

      /*
        Hold the stock now, as the scheduled sync does. This button used to
        insert without holding, and once it had seen an order the scheduled
        sync treated it as existing and never held it either — so the wine
        stayed "available" for the next order until release.
      */
      // A draft that was being held hands its holds over first, so the
      // order's own hold step only takes what the draft did not have
      await adoptDraftHolds({ db, zohoSalesOrderId: fullOrder.salesorder_id, orderId: newOrderId });

      const hold = await holdStockForSalesOrder({
        db,
        orderId: newOrderId,
        orderNumber: fullOrder.salesorder_number,
      });

      await db
        .update(zohoSalesOrders)
        .set({ zohoLastModifiedTime: new Date(fullOrder.last_modified_time) })
        .where(eq(zohoSalesOrders.id, newOrderId));

      if (hold.short.length) {
        shortOnSync.push(
          `${fullOrder.salesorder_number}: ${hold.short.map((s) => `${s.name} (${s.bottlesShort} btl short)`).join(', ')}`,
        );
      }

      results.created++;
    } catch (error) {
      results.errors++;
      failed.push({
        salesOrderNumber: zohoOrder.salesorder_number,
        reason: (error instanceof Error ? error.message : String(error)).slice(0, 160),
      });
      console.error('Failed to sync sales order', {
        salesOrderNumber: zohoOrder.salesorder_number,
        error,
      });
    }
  }

  // Held drafts follow their Zoho draft: lines changed, voided, confirmed
  const drafts = await refreshAllDraftHolds({ db });

  /*
    An order voided in Zoho releases its stock here too, so pressing Sync
    clears it straight away rather than on the next scheduled run.
  */
  // Nothing listed at all is an outage, which releaseClosedOrderHolds spots
  // by the empty list, so the window's orders are only added to a real listing
  const closed = await (
    salesOrders.length ? invoicedOutsideWindow(invoicedModifiedSince) : Promise.resolve([])
  )
    .then((outsideWindow) =>
      releaseClosedOrderHolds({
        db,
        seenZohoIds: [...salesOrders.map((order) => order.salesorder_id), ...outsideWindow],
      }),
    )
    .catch((error) => {
    console.error('Failed to release stock for closed orders', { error });
    return { checked: 0, released: [] };
  });
  // Which PCO each order fulfils, including ones raised by hand in Zoho
  await linkSalesOrdersToPcos({ db }).catch((error) => {
    console.error('Failed to link sales orders to PCOs', { error });
  });

  logger.info('Zoho sales order sync', {
    listed: results.fetched,
    changed,
    skipped,
    created: results.created,
    updated: results.updated,
    errors: results.errors,
    invoicedListing: invoicedModifiedSince ? 'recent' : 'full',
    durationMs: Date.now() - startedAt,
  });

  const releasedNote = closed.released.length
    ? `. Released stock held for ${closed.released.map((order) => `${order.salesOrderNumber} (${order.status} in Zoho)`).join(', ')}`
    : '';

  return {
    success: true,
    ...results,
    draftHoldsRefreshed: drafts.refreshed,
    failed,
    shortOnSync,
    releasedClosed: closed.released,
    message: `Synced ${results.created} new, ${results.updated} updated from ${results.fetched} orders${
      shortOnSync.length ? `. Not enough free stock for: ${shortOnSync.join('; ')}` : ''
    }${releasedNote}`,
  };
};

export default syncSalesOrdersFromZoho;
