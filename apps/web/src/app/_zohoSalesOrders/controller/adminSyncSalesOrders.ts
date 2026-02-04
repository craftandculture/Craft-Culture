/**
 * Manual Sync Zoho Sales Orders
 *
 * Triggers an immediate sync of sales orders from Zoho Books.
 * Used when you don't want to wait for the scheduled job.
 */

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { zohoSalesOrderItems, zohoSalesOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { getSalesOrder, listSalesOrders } from '@/lib/zoho/salesOrders';

const adminSyncSalesOrders = adminProcedure.mutation(async () => {
  if (!isZohoConfigured()) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Zoho integration not configured',
    });
  }

  const results = {
    fetched: 0,
    created: 0,
    updated: 0,
    errors: 0,
  };

  // Fetch sales orders from Zoho that need fulfillment
  const [openOrders, invoicedOrders] = await Promise.all([
    listSalesOrders({ status: 'open', perPage: 100 }),
    listSalesOrders({ status: 'invoiced', perPage: 100 }),
  ]);

  const salesOrders = [
    ...openOrders.salesOrders,
    ...invoicedOrders.salesOrders,
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
        // Already synced, update if still in synced status
        if (existing.status === 'synced') {
          await db
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
      const [newOrder] = await db
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
        await db.insert(zohoSalesOrderItems).values(
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

      results.created++;
    } catch (error) {
      results.errors++;
      console.error(`Failed to sync sales order ${zohoOrder.salesorder_number}`, error);
    }
  }

  return {
    success: true,
    ...results,
    message: `Synced ${results.created} new, ${results.updated} updated from ${results.fetched} orders`,
  };
});

export default adminSyncSalesOrders;
