/**
 * Get Zoho Sales Order Details
 *
 * Returns a single sales order with all line items.
 */

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  wmsPickLists,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const adminGetSalesOrder = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input }) => {
    const [order] = await db
      .select()
      .from(zohoSalesOrders)
      .where(eq(zohoSalesOrders.id, input.id));

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Sales order not found',
      });
    }

    const items = await db
      .select()
      .from(zohoSalesOrderItems)
      .where(eq(zohoSalesOrderItems.salesOrderId, order.id));

    // Get pick list if exists
    let pickList = null;
    if (order.pickListId) {
      const [pl] = await db
        .select()
        .from(wmsPickLists)
        .where(eq(wmsPickLists.id, order.pickListId));
      pickList = pl;
    }

    return {
      ...order,
      items,
      pickList,
    };
  });

export default adminGetSalesOrder;
