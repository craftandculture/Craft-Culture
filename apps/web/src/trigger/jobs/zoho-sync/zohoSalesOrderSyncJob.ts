/**
 * Zoho Sales Order Sync Job
 *
 * Scheduled job that syncs sales orders from Zoho Books into the system.
 * Fetches open/confirmed sales orders that need fulfillment.
 */

import { logger, schedules } from '@trigger.dev/sdk';
import { and, eq, isNull } from 'drizzle-orm';

import releaseStockReservations from '@/app/_wms/utils/releaseStockReservations';
import reserveStockForOrderItems from '@/app/_wms/utils/reserveStockForOrderItems';
import syncExistingSalesOrder from '@/app/_wms/utils/syncExistingSalesOrder';
import {
  wmsStockReservations,
  zohoInvoices,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { isZohoConfigured } from '@/lib/zoho/client';
import { getSalesOrder, listAllSalesOrdersByStatus } from '@/lib/zoho/salesOrders';
import triggerDb from '@/trigger/triggerDb';

export const zohoSalesOrderSyncJob = schedules.task({
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

      for (const zohoOrder of salesOrders) {
        try {
          // Check if we already have this order
          const [existing] = await triggerDb
            .select({ id: zohoSalesOrders.id, status: zohoSalesOrders.status })
            .from(zohoSalesOrders)
            .where(eq(zohoSalesOrders.zohoSalesOrderId, zohoOrder.salesorder_id))
            .limit(1);

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
            const [needsInvoice] = await triggerDb
              .select({ id: zohoSalesOrders.id })
              .from(zohoSalesOrders)
              .where(
                and(
                  eq(zohoSalesOrders.id, existing.id),
                  isNull(zohoSalesOrders.invoiceNumber),
                ),
              )
              .limit(1);

            if (needsInvoice) {
              const [invoice] = await triggerDb
                .select({ invoiceNumber: zohoInvoices.invoiceNumber })
                .from(zohoInvoices)
                .where(eq(zohoInvoices.referenceNumber, zohoOrder.salesorder_number))
                .limit(1);

              if (invoice?.invoiceNumber) {
                await triggerDb
                  .update(zohoSalesOrders)
                  .set({ invoiceNumber: invoice.invoiceNumber })
                  .where(eq(zohoSalesOrders.id, existing.id));
              }
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
                discount: fullOrder.discount,
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

          // Reserve WMS stock for the new order
          try {
            const insertedItems = await triggerDb
              .select({
                id: zohoSalesOrderItems.id,
                sku: zohoSalesOrderItems.sku,
                lwin18: zohoSalesOrderItems.lwin18,
                name: zohoSalesOrderItems.name,
                quantity: zohoSalesOrderItems.quantity,
              })
              .from(zohoSalesOrderItems)
              .where(eq(zohoSalesOrderItems.salesOrderId, newOrder.id));

            const reservationItems = insertedItems
              .filter((item) => item.sku || item.lwin18)
              .map((item) => ({
                orderItemId: item.id,
                lwin18: item.lwin18 ?? item.sku ?? '',
                productName: item.name,
                quantityCases: item.quantity,
              }));

            if (reservationItems.length > 0) {
              const reservationResult = await reserveStockForOrderItems({
                orderType: 'zoho',
                orderId: newOrder.id,
                orderNumber: fullOrder.salesorder_number,
                items: reservationItems,
                db: triggerDb,
              });

              if (reservationResult.short.length > 0) {
                logger.warn(
                  `Stock shortage for ${fullOrder.salesorder_number}`,
                  { short: reservationResult.short },
                );
              }
            }
          } catch (reserveError) {
            // Don't fail the sync if reservation fails
            logger.error(
              `Failed to reserve stock for ${fullOrder.salesorder_number}`,
              { error: reserveError },
            );
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

    /*
      Release stock held for orders that no longer exist in Zoho.

      This sync fetches open and invoiced orders only, so an order that is
      voided or cancelled simply stops appearing — and nothing released the
      cases it was holding. They sat reserved indefinitely, which is why stock
      showed as allocated with no order behind it.

      Absence alone is not proof: a paging failure or a rate limit looks
      identical. Each candidate is fetched individually and released only when
      Zoho confirms it is void or draft.
    */
    try {
      const seen = new Set(salesOrderIdsSeen);

      // Nothing came back at all — that is an outage, not an empty Zoho.
      if (seen.size === 0) throw new Error('no orders fetched; skipping sweep');

      const candidates = await triggerDb
        .selectDistinct({
          id: zohoSalesOrders.id,
          zohoSalesOrderId: zohoSalesOrders.zohoSalesOrderId,
          salesOrderNumber: zohoSalesOrders.salesOrderNumber,
        })
        .from(zohoSalesOrders)
        .innerJoin(
          wmsStockReservations,
          and(
            eq(wmsStockReservations.orderId, zohoSalesOrders.id),
            eq(wmsStockReservations.orderType, 'zoho'),
            eq(wmsStockReservations.status, 'active'),
          ),
        )
        .limit(25);

      for (const candidate of candidates) {
        if (seen.has(candidate.zohoSalesOrderId)) continue;

        const remote = await getSalesOrder(candidate.zohoSalesOrderId).catch(
          () => null,
        );

        // Unreachable is not the same as gone. Leave it for the next run.
        if (!remote) continue;

        if (remote.status !== 'void' && remote.status !== 'draft') continue;

        const released = await releaseStockReservations({
          orderType: 'zoho',
          orderId: candidate.id,
          reason: `Order ${remote.status} in Zoho`,
          db: triggerDb,
        });

        if (released.releasedCount > 0) {
          logger.info(
            `Released ${released.totalCasesReleased} cases held for ${candidate.salesOrderNumber} (${remote.status} in Zoho)`,
          );
        }
      }
    } catch (error) {
      logger.error('Failed to release stock for closed orders', { error });
    }

    logger.info('Zoho sales order sync completed', results);
    return results;
  },
});
