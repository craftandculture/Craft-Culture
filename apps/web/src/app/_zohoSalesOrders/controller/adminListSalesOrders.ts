/**
 * List Zoho Sales Orders
 *
 * Returns synced sales orders from Zoho Books with their status and items.
 */

import { desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { zohoSalesOrderItems, zohoSalesOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const adminListSalesOrders = adminProcedure.query(async () => {
  const orders = await db
    .select()
    .from(zohoSalesOrders)
    .orderBy(desc(zohoSalesOrders.createdAt))
    .limit(100);

  // Fetch item counts for each order
  const ordersWithItems = await Promise.all(
    orders.map(async (order) => {
      const items = await db
        .select()
        .from(zohoSalesOrderItems)
        .where(eq(zohoSalesOrderItems.salesOrderId, order.id));

      return {
        ...order,
        itemCount: items.length,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      };
    }),
  );

  return ordersWithItems;
});

export default adminListSalesOrders;
