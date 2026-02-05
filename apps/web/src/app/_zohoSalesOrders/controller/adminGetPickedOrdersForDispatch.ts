/**
 * Get picked Zoho Sales Orders ready for dispatch batch
 *
 * Returns orders with status 'picked' that haven't been assigned to a dispatch batch.
 * Optionally filter by distributor name.
 */

import { and, eq, isNull, like } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { zohoSalesOrderItems, zohoSalesOrders } from '@/database/schema';
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
    const conditions = [
      eq(zohoSalesOrders.status, 'picked'),
      isNull(zohoSalesOrders.dispatchBatchId),
    ];

    // Optionally filter by distributor name (case-insensitive partial match)
    if (input?.distributorName) {
      conditions.push(like(zohoSalesOrders.customerName, `%${input.distributorName}%`));
    }

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
      .where(and(...conditions));

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
