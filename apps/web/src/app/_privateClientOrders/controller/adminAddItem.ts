import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrderItems, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import addItemSchema from '../schemas/addItemSchema';

/**
 * Recalculate order totals based on line items
 */
const recalculateOrderTotals = async (orderId: string) => {
  // Get sum of all items
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
  // TODO: Pull from partner settings
  const logisticsPerCase = 60;
  const logisticsUsd = caseCount * logisticsPerCase;

  const totalUsd = subtotalUsd + dutyUsd + vatUsd + logisticsUsd;

  // Update the order
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

/**
 * Admin add a line item to a private client order
 *
 * Admins can add items to any order. Order must be in editable status.
 * Automatically recalculates order totals.
 */
const adminAddItem = adminProcedure
  .input(addItemSchema)
  .mutation(async ({ input }) => {
    const { orderId, quantity, pricePerCaseUsd, ...itemData } = input;

    // Verify order exists
    const [order] = await db
      .select()
      .from(privateClientOrders)
      .where(eq(privateClientOrders.id, orderId));

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    // Only allow edits in draft or revision_requested status
    if (!['draft', 'revision_requested'].includes(order.status)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Order cannot be modified in current status',
      });
    }

    const totalUsd = quantity * pricePerCaseUsd;

    // Insert the item
    const [item] = await db
      .insert(privateClientOrderItems)
      .values({
        orderId,
        ...itemData,
        quantity,
        pricePerCaseUsd,
        totalUsd,
      })
      .returning();

    // Recalculate order totals
    await recalculateOrderTotals(orderId);

    return item;
  });

export default adminAddItem;
