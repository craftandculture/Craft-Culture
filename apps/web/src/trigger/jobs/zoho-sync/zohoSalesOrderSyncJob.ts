/**
 * Zoho Sales Order Sync Job
 *
 * Scheduled job that syncs sales orders from Zoho Books into the system.
 * Fetches open/confirmed sales orders that need fulfillment.
 */

import { logger, schedules } from '@trigger.dev/sdk';
import { eq, inArray } from 'drizzle-orm';

import canonicalSku from '@/app/_wms/utils/canonicalSku';
import holdStockForSalesOrder from '@/app/_wms/utils/holdStockForSalesOrder';
import syncExistingSalesOrder from '@/app/_wms/utils/syncExistingSalesOrder';
import { adoptDraftHolds, refreshAllDraftHolds } from '@/app/_zohoSalesOrders/data/draftHolds';
import linkSalesOrdersToPcos from '@/app/_zohoSalesOrders/data/linkSalesOrdersToPcos';
import releaseClosedOrderHolds from '@/app/_zohoSalesOrders/data/releaseClosedOrderHolds';
import {
  zohoInvoices,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { isZohoConfigured } from '@/lib/zoho/client';
import discountAmount from '@/lib/zoho/discountAmount';
import { getSalesOrder, listAllSalesOrdersByStatus } from '@/lib/zoho/salesOrders';
import triggerDb from '@/trigger/triggerDb';

export const zohoSalesOrderSyncJob = schedules.task({
  // Scheduled every few minutes: the next run is the retry. Without these the
  // project defaults (5 attempts, 5 hours) let failing runs pile up and spend
  // the Trigger.dev budget (25 Oct 2026).
  retry: { maxAttempts: 1 },
  maxDuration: 5 * 60,
  id: 'zoho-sales-order-sync',
  cron: {
    pattern: '*/2 * * * *', // Every 2 minutes
    timezone: 'Asia/Dubai',
  },
  async run() {
    logger.info('Starting Zoho sales order sync');

    /* What Zoho actually returned this run, so absence can be told from failure. */
    const salesOrderIdsSeen: string[] = [];

    if (!isZohoConfigured()) {
      logger.warn('Zoho integration not configured, skipping sync');
      return { skipped: true, reason: 'not_configured' };
    }

    const results = {
      fetched: 0,
      created: 0,
      updated: 0,
      errors: 0,
    };

    try {
      // Fetch all sales orders from Zoho that need fulfillment (paginated)
      // - 'open' = confirmed, awaiting invoice
      // - 'invoiced' = fully invoiced, ready for fulfillment
      const [openOrders, invoicedOrders] = await Promise.all([
        listAllSalesOrdersByStatus('open'),
        listAllSalesOrdersByStatus('invoiced'),
      ]);

      const salesOrders = [
        ...openOrders,
        ...invoicedOrders,
      ];

      salesOrderIdsSeen.push(
        ...salesOrders.map((salesOrder) => salesOrder.salesorder_id),
      );

      results.fetched = salesOrders.length;
      logger.info(
        `Fetched ${salesOrders.length} sales orders from Zoho (${openOrders.length} open, ${invoicedOrders.length} invoiced)`,
      );

      /*
        Read the local orders and their invoices once for the whole listing,
        instead of three queries per order every two minutes.
      */
      const existingByZohoId = new Map<
        string,
        { id: string; status: string | null; invoiceNumber: string | null }
      >();
      const invoiceBySoNumber = new Map<string, string>();
      const LOOKUP_CHUNK = 500;

      for (let i = 0; i < salesOrders.length; i += LOOKUP_CHUNK) {
        const chunk = salesOrders.slice(i, i + LOOKUP_CHUNK);
        const [rows, invoices] = await Promise.all([
          triggerDb
            .select({
              id: zohoSalesOrders.id,
              status: zohoSalesOrders.status,
              invoiceNumber: zohoSalesOrders.invoiceNumber,
              zohoSalesOrderId: zohoSalesOrders.zohoSalesOrderId,
            })
            .from(zohoSalesOrders)
            .where(
              inArray(
                zohoSalesOrders.zohoSalesOrderId,
                chunk.map((order) => order.salesorder_id),
              ),
            ),
          triggerDb
            .select({
              referenceNumber: zohoInvoices.referenceNumber,
              invoiceNumber: zohoInvoices.invoiceNumber,
            })
            .from(zohoInvoices)
            .where(
              inArray(
                zohoInvoices.referenceNumber,
                chunk.map((order) => order.salesorder_number),
              ),
            ),
        ]);

        for (const row of rows) {
          existingByZohoId.set(row.zohoSalesOrderId, {
            id: row.id,
            status: row.status,
            invoiceNumber: row.invoiceNumber,
          });
        }
        for (const invoice of invoices) {
          if (
            invoice.referenceNumber &&
            invoice.invoiceNumber &&
            !invoiceBySoNumber.has(invoice.referenceNumber)
          ) {
            invoiceBySoNumber.set(invoice.referenceNumber, invoice.invoiceNumber);
          }
        }
      }

      for (const zohoOrder of salesOrders) {
        try {
          // Check if we already have this order
          const existingRow = existingByZohoId.get(zohoOrder.salesorder_id);
          const existing = existingRow
            ? { id: existingRow.id, status: existingRow.status }
            : undefined;

          if (existing) {
            // Both sync paths funnel through one helper so they can never drift.
            // Pre-pick orders reconcile in full; orders already released to
            // picking are flagged for review rather than silently rewritten.
            const syncResult = await syncExistingSalesOrder({
              existing,
              zohoOrder,
              db: triggerDb,
            });

            if (syncResult.outcome === 'reconciled') {
              if (
                syncResult.reconciled.added ||
                syncResult.reconciled.updated ||
                syncResult.reconciled.removed
              ) {
                logger.info(
                  `Reconciled line items for ${zohoOrder.salesorder_number}`,
                  syncResult.reconciled,
                );
              }
              results.updated++;
            } else if (syncResult.outcome === 'flagged') {
              logger.info(
                `Flagged ${zohoOrder.salesorder_number} — Zoho edit after release to pick`,
              );
              results.updated++;
            }

            // Backfill invoice_number if missing
            const invoiceNumber = invoiceBySoNumber.get(zohoOrder.salesorder_number);
            if (!existingRow?.invoiceNumber && invoiceNumber) {
              await triggerDb
                .update(zohoSalesOrders)
                .set({ invoiceNumber })
                .where(eq(zohoSalesOrders.id, existing.id));
            }

            continue;
          }

          // Fetch full order details with line items
          const fullOrder = await getSalesOrder(zohoOrder.salesorder_id);

          // Create order + line items in a transaction to prevent orphaned records
          const newOrder = await triggerDb.transaction(async (tx) => {
            const [order] = await tx
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
                zohoLastModifiedTime: new Date(fullOrder.last_modified_time),
                lastSyncAt: new Date(),
              })
              .returning({ id: zohoSalesOrders.id });

            if (fullOrder.line_items && fullOrder.line_items.length > 0) {
              await tx.insert(zohoSalesOrderItems).values(
                fullOrder.line_items.map((item) => ({
                  salesOrderId: order.id,
                  zohoLineItemId: item.line_item_id,
                  zohoItemId: item.item_id,
                  sku: canonicalSku(item.sku),
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

            return order;
          });

          // Link invoice number from zohoInvoices (matched by reference_number = SO number)
          try {
            const [invoice] = await triggerDb
              .select({ invoiceNumber: zohoInvoices.invoiceNumber })
              .from(zohoInvoices)
              .where(eq(zohoInvoices.referenceNumber, fullOrder.salesorder_number))
              .limit(1);

            if (invoice?.invoiceNumber) {
              await triggerDb
                .update(zohoSalesOrders)
                .set({ invoiceNumber: invoice.invoiceNumber })
                .where(eq(zohoSalesOrders.id, newOrder.id));
            }
          } catch (invoiceError) {
            logger.warn(
              `Failed to link invoice for ${fullOrder.salesorder_number}`,
              { error: invoiceError },
            );
          }

          // Hold WMS stock for the new order — the same step the Sync button,
          // line edits and release use, so all four hold stock the same way
          try {
            await adoptDraftHolds({ db: triggerDb, zohoSalesOrderId: fullOrder.salesorder_id, orderId: newOrder.id });

            const hold = await holdStockForSalesOrder({
              db: triggerDb,
              orderId: newOrder.id,
              orderNumber: fullOrder.salesorder_number,
            });

            if (hold.short.length > 0) {
              logger.warn(`Stock shortage for ${fullOrder.salesorder_number}`, { short: hold.short });
            }
          } catch (reserveError) {
            // Don't fail the sync if holding fails
            logger.error(`Failed to hold stock for ${fullOrder.salesorder_number}`, { error: reserveError });
          }

          results.created++;
          logger.info(`Created sales order ${fullOrder.salesorder_number}`, {
            zohoId: fullOrder.salesorder_id,
            orderId: newOrder.id,
          });
        } catch (error) {
          results.errors++;
          logger.error(`Failed to sync sales order ${zohoOrder.salesorder_number}`, {
            error,
            zohoId: zohoOrder.salesorder_id,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to fetch sales orders from Zoho', { error });
      results.errors++;
    }

    /* Stock held for orders voided in Zoho, which the listing no longer returns */
    try {
      const closed = await releaseClosedOrderHolds({
        db: triggerDb,
        seenZohoIds: salesOrderIdsSeen,
      });
      for (const order of closed.released) {
        logger.info(
          `Released ${order.cases} cases held for ${order.salesOrderNumber} (${order.status} in Zoho)`,
        );
      }
    } catch (error) {
      logger.error('Failed to release stock for closed orders', { error });
    }

    try {
      const drafts = await refreshAllDraftHolds({ db: triggerDb });
      if (drafts.active) logger.info('Draft holds refreshed', drafts);
    } catch (error) {
      logger.error('Failed to refresh draft holds', { error });
    }

    /* Which PCO each order fulfils, including ones raised by hand in Zoho */
    try {
      const links = await linkSalesOrdersToPcos({ db: triggerDb });
      if (links.byPco || links.byReference || links.backToPco) {
        logger.info('Sales orders linked to their PCOs', links);
      }
    } catch (error) {
      logger.error('Failed to link sales orders to PCOs', { error });
    }

    logger.info('Zoho sales order sync completed', results);
    return results;
  },
});
