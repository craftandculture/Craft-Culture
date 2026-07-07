/**
 * Get Zoho Sales Order Details
 *
 * Returns a single sales order with all line items.
 */

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import resolveLineRepack from '@/app/_wms/utils/resolveLineRepack';
import db from '@/database/client';
import {
  wmsPickLists,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

const adminGetSalesOrder = wmsOperatorProcedure
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

    const rawItems = await db
      .select()
      .from(zohoSalesOrderItems)
      .where(eq(zohoSalesOrderItems.salesOrderId, order.id));

    // Every line is `quantity` cases of its ordered pack format. Resolve each
    // against live stock to see if it must be repacked (ordered pack not on the
    // shelf) — e.g. order a 3×75cl, only a 6×75cl in stock → break the 6-pack.
    const items = await Promise.all(
      rawItems.map(async (item) => {
        const repack = await resolveLineRepack({
          name: item.name,
          sku: item.sku,
          description: item.description,
          db,
        });
        return { ...item, repack };
      }),
    );

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
