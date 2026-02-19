/**
 * Zoho Sales Order Sync Job
 *
 * Scheduled job that syncs sales orders from Zoho Books into the system.
 * Fetches open/confirmed sales orders that need fulfillment.
 */

import { logger, schedules } from '@trigger.dev/sdk';
import { eq } from 'drizzle-orm';

import reserveStockForOrderItems from '@/app/_wms/utils/reserveStockForOrderItems';
import { zohoSalesOrderItems, zohoSalesOrders } from '@/database/schema';
import { isZohoConfigured } from '@/lib/zoho/client';
import { getSalesOrder, listSalesOrders } from '@/lib/zoho/salesOrders';
import triggerDb from '@/trigger/triggerDb';

export const zohoSalesOrderSyncJob = schedules.task({
  id: 'zoho-sales-order-sync',
  cron: {
    pattern: '*/2 * * * *', // Every 2 minutes
    timezone: 'Asia/Dubai',
  },
  async run() {
    logger.info('Starting Zoho sales order sync');

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
      // Fetch sales orders from Zoho that need fulfillment
      // - 'open' = confirmed, awaiting invoice
      // - 'invoiced' = fully invoiced, ready for fulfillment
      const [openOrders, invoicedOrders] = await Promise.all([
        listSalesOrders({ status: 'open', perPage: 100 }),
        listSalesOrders({ status: 'invoiced', perPage: 100 }),
      ]);

      const salesOrders = [
        ...openOrders.salesOrders,
        ...invoicedOrders.salesOrders,
      ];

      results.fetched = salesOrders.length;
      logger.info(
        `Fetched ${salesOrders.length} sales orders from Zoho (${openOrders.salesOrders.length} open, ${invoicedOrders.salesOrders.length} invoiced)`,
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
            // Already synced, check if we need to update
            // Don't update if we've started processing (picking, etc.)
            if (existing.status === 'synced') {
              await triggerDb
                .update(zohoSalesOrders)
                .set({
                  zohoStatus: zohoOrder.status,
                  zohoLastModifiedTime: new Date(zohoOrder.last_modified_time),
                  lastSyncAt: new Date(),
                })
                .where(eq(zohoSalesOrders.id, existing.id));
              results.updated++;
            }
            continue;
          }

          // Fetch full order details with line items
          const fullOrder = await getSalesOrder(zohoOrder.salesorder_id);

          // Create new sales order
          const [newOrder] = await triggerDb
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

          // Create line items
          if (fullOrder.line_items && fullOrder.line_items.length > 0) {
            await triggerDb.insert(zohoSalesOrderItems).values(
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
                discount: item.discount,
                itemTotal: item.item_total,
              })),
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

    logger.info('Zoho sales order sync completed', results);
    return results;
  },
});
