/**
 * Get picked Zoho Sales Orders ready for dispatch batch
 *
 * Returns orders ready for dispatch that haven't been assigned to a dispatch batch.
 * Includes orders with status 'picked' OR orders with a completed pick list.
 * Optionally filter by distributor name.
 */

import { and, eq, inArray, isNull, like, or } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsPickLists, zohoSalesOrderItems, zohoSalesOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const adminGetPickedOrdersForDispatch = adminProcedure
  .input(
    z
      .object({
        distributorName: z.string().optional(),
      })
      .optional(),
  )
  .query(async ({ input }) => {
    // First get IDs of orders with completed pick lists
    const completedPickLists = await db
      .select({ orderId: wmsPickLists.orderId })
      .from(wmsPickLists)
      .where(eq(wmsPickLists.status, 'completed'));

    const orderIdsWithCompletedPicks = completedPickLists.map((p) => p.orderId);

    // Build conditions: must not have dispatch batch, and either:
    // 1. Status is 'picked', OR
    // 2. Has a completed pick list
    const baseConditions = [isNull(zohoSalesOrders.dispatchBatchId)];

    // Optionally filter by distributor name (case-insensitive partial match)
    if (input?.distributorName) {
      baseConditions.push(like(zohoSalesOrders.customerName, `%${input.distributorName}%`));
    }

    // Build the status condition
    const statusCondition =
      orderIdsWithCompletedPicks.length > 0
        ? or(
            eq(zohoSalesOrders.status, 'picked'),
            inArray(zohoSalesOrders.id, orderIdsWithCompletedPicks),
          )
        : eq(zohoSalesOrders.status, 'picked');

    const orders = await db
      .select({
        id: zohoSalesOrders.id,
        salesOrderNumber: zohoSalesOrders.salesOrderNumber,
        customerName: zohoSalesOrders.customerName,
        total: zohoSalesOrders.total,
        orderDate: zohoSalesOrders.orderDate,
        status: zohoSalesOrders.status,
      })
      .from(zohoSalesOrders)
      .where(and(...baseConditions, statusCondition));

    // Get item counts for each order
    const ordersWithCases = await Promise.all(
      orders.map(async (order) => {
        const items = await db
          .select({
            quantity: zohoSalesOrderItems.quantity,
          })
          .from(zohoSalesOrderItems)
          .where(eq(zohoSalesOrderItems.salesOrderId, order.id));

        const totalCases = items.reduce((sum, item) => sum + item.quantity, 0);

        return {
          ...order,
          totalCases,
        };
      }),
    );

    return { orders: ordersWithCases };
  });

export default adminGetPickedOrdersForDispatch;
