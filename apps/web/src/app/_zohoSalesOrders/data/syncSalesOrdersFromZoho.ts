import { eq } from 'drizzle-orm';

import holdStockForSalesOrder from '@/app/_wms/utils/holdStockForSalesOrder';
import syncExistingSalesOrder from '@/app/_wms/utils/syncExistingSalesOrder';
import { adoptDraftHolds, refreshAllDraftHolds } from '@/app/_zohoSalesOrders/data/draftHolds';
import linkSalesOrdersToPcos from '@/app/_zohoSalesOrders/data/linkSalesOrdersToPcos';
import releaseClosedOrderHolds from '@/app/_zohoSalesOrders/data/releaseClosedOrderHolds';
import pickInvoiceNumber from '@/app/_zohoSalesOrders/utils/pickInvoiceNumber';
import db from '@/database/client';
import { zohoSalesOrderItems, zohoSalesOrders } from '@/database/schema';
import discountAmount from '@/lib/zoho/discountAmount';
import { getSalesOrder, listAllSalesOrdersByStatus } from '@/lib/zoho/salesOrders';

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
 * @returns Counts, failures and a one-line summary
 */
const syncSalesOrdersFromZoho = async ({
  forceRefreshOrderNumbers = [],
}: { forceRefreshOrderNumbers?: string[] } = {}) => {
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

  // Fetch all sales orders from Zoho that need fulfillment (paginated)
  const [openOrders, invoicedOrders] = await Promise.all([
    listAllSalesOrdersByStatus('open'),
    listAllSalesOrdersByStatus('invoiced'),
  ]);

  const salesOrders = [
    ...openOrders,
    ...invoicedOrders,
  ];

  results.fetched = salesOrders.length;

  for (const zohoOrder of salesOrders) {
    try {
      // Check if we already have this order
      const [existing] = await db
        .select({ id: zohoSalesOrders.id, status: zohoSalesOrders.status })
        .from(zohoSalesOrders)
        .where(eq(zohoSalesOrders.zohoSalesOrderId, zohoOrder.salesorder_id))
        .limit(1);

      if (existing) {
        // Route through the shared helper so this button and the scheduled job
        // stay identical. Previously this path was insert-only and silently
        // dropped quantity edits (the SO-00099 Talbot bug).
        const syncResult = await syncExistingSalesOrder({
          existing,
          zohoOrder,
          db,
          force: forceOrderNumbers.has(zohoOrder.salesorder_number),
        });

        if (
          syncResult.outcome === 'reconciled' ||
          syncResult.outcome === 'flagged'
        ) {
          results.updated++;
        }
        continue;
      }

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
  const closed = await releaseClosedOrderHolds({
    db,
    seenZohoIds: salesOrders.map((order) => order.salesorder_id),
  }).catch((error) => {
    console.error('Failed to release stock for closed orders', { error });
    return { checked: 0, released: [] };
  });
  // Which PCO each order fulfils, including ones raised by hand in Zoho
  await linkSalesOrdersToPcos({ db }).catch((error) => {
    console.error('Failed to link sales orders to PCOs', { error });
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
