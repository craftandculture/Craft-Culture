/**
 * Approve Zoho Sales Orders for Picking
 *
 * Marks selected sales orders as approved, releasing them to the warehouse
 * for pick list creation. Supports batch approval for efficient picking.
 */

import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { zohoSalesOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const adminApproveSalesOrders = adminProcedure
  .input(
    z.object({
      orderIds: z.array(z.string().uuid()).min(1, 'Select at least one order'),
    }),
  )
  .mutation(async ({ input }) => {
    const { orderIds } = input;

    // Verify all orders exist and are in 'synced' status
    const orders = await db
      .select({ id: zohoSalesOrders.id, status: zohoSalesOrders.status })
      .from(zohoSalesOrders)
      .where(inArray(zohoSalesOrders.id, orderIds));

    if (orders.length !== orderIds.length) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'One or more orders not found',
      });
    }

    const notSynced = orders.filter((o) => o.status !== 'synced');
    if (notSynced.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${notSynced.length} order(s) are not in 'synced' status and cannot be approved`,
      });
    }

    // Approve all orders
    await db
      .update(zohoSalesOrders)
      .set({
        status: 'approved',
        updatedAt: new Date(),
      })
      .where(inArray(zohoSalesOrders.id, orderIds));

    return {
      success: true,
      approvedCount: orderIds.length,
      message: `${orderIds.length} order(s) approved for picking`,
    };
  });

export default adminApproveSalesOrders;
