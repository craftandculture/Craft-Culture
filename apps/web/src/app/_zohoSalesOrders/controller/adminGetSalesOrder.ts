/**
 * Get Zoho Sales Order Details
 *
 * Returns a single sales order with all line items.
 */

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import resolveSingleBottleRepack from '@/app/_wms/utils/resolveSingleBottleRepack';
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

    // For single-bottle lines, resolve the real pick source from live stock
    // (pick loose if available, else the smallest pack to break — a repack).
    const items = await Promise.all(
      rawItems.map(async (item) => {
        if (!/single bottle/i.test(item.name ?? '')) {
          return { ...item, repack: null };
        }
        const repack = await resolveSingleBottleRepack({
          name: item.name,
          sku: item.sku,
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
