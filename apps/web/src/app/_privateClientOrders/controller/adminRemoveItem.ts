import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderItems, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const adminRemoveItemSchema = z.object({
  itemId: z.string().uuid(),
});

/**
 * Recalculate order totals based on line items
 */
const recalculateOrderTotals = async (orderId: string) => {
  const [totals] = await db
    .select({
      itemCount: sql<number>`count(*)`,
      caseCount: sql<number>`coalesce(sum(${privateClientOrderItems.quantity}), 0)`,
      subtotalUsd: sql<number>`coalesce(sum(${privateClientOrderItems.totalUsd}), 0)`,
    })
    .from(privateClientOrderItems)
    .where(eq(privateClientOrderItems.orderId, orderId));

  const itemCount = Number(totals?.itemCount ?? 0);
  const caseCount = Number(totals?.caseCount ?? 0);
  const subtotalUsd = Number(totals?.subtotalUsd ?? 0);

  // Calculate duty and VAT (5% each for UAE)
  const dutyUsd = subtotalUsd * 0.05;
  const vatUsd = (subtotalUsd + dutyUsd) * 0.05;

  // Get partner's logistics cost per case (default $60)
  const logisticsPerCase = 60;
  const logisticsUsd = caseCount * logisticsPerCase;

  const totalUsd = subtotalUsd + dutyUsd + vatUsd + logisticsUsd;

  await db
    .update(privateClientOrders)
    .set({
      itemCount,
      caseCount,
      subtotalUsd,
      dutyUsd,
      vatUsd,
      logisticsUsd,
      totalUsd,
      updatedAt: new Date(),
    })
    .where(eq(privateClientOrders.id, orderId));
};

// Statuses where admin cannot edit (final statuses)
const NON_EDITABLE_STATUSES = ['delivered', 'cancelled'];

/**
 * Admin remove a line item from a private client order
 *
 * Admins can remove items from any order except delivered or cancelled orders.
 */
const adminRemoveItem = adminProcedure
  .input(adminRemoveItemSchema)
  .mutation(async ({ input }) => {
    const { itemId } = input;

    // Fetch the item with its order
    const item = await db.query.privateClientOrderItems.findFirst({
      where: { id: itemId },
      with: {
        order: {
          columns: { id: true, status: true },
        },
      },
    });

    if (!item) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Item not found',
      });
    }

    // Check order status allows editing
    if (NON_EDITABLE_STATUSES.includes(item.order.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot remove items from a delivered or cancelled order',
      });
    }

    // Delete the item
    await db.delete(privateClientOrderItems).where(eq(privateClientOrderItems.id, itemId));

    // Recalculate order totals
    await recalculateOrderTotals(item.order.id);

    return { success: true, deletedItemId: itemId };
  });

export default adminRemoveItem;
