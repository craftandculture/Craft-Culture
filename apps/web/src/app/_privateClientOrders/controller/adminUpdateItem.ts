import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderItems, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const adminUpdateItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive().optional(),
  pricePerCaseUsd: z.number().positive().optional(),
  productName: z.string().min(1).optional(),
  producer: z.string().optional(),
  vintage: z.string().optional(),
  notes: z.string().optional(),
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
 * Admin update a line item in a private client order
 *
 * Admins can update items in any order except delivered or cancelled orders.
 */
const adminUpdateItem = adminProcedure
  .input(adminUpdateItemSchema)
  .mutation(async ({ input }) => {
    const { itemId, quantity, pricePerCaseUsd, productName, producer, vintage, notes } = input;

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
        message: 'Cannot edit items in a delivered or cancelled order',
      });
    }

    // Build update object
    const updateData: {
      quantity?: number;
      pricePerCaseUsd?: number;
      totalUsd?: number;
      productName?: string;
      producer?: string;
      vintage?: string;
      notes?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (quantity !== undefined) {
      updateData.quantity = quantity;
    }

    if (pricePerCaseUsd !== undefined) {
      updateData.pricePerCaseUsd = pricePerCaseUsd;
    }

    if (productName !== undefined) {
      updateData.productName = productName;
    }

    if (producer !== undefined) {
      updateData.producer = producer;
    }

    if (vintage !== undefined) {
      updateData.vintage = vintage;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Calculate new total if quantity or price changed
    const newQuantity = quantity ?? item.quantity;
    const newPrice = pricePerCaseUsd ?? Number(item.pricePerCaseUsd);
    updateData.totalUsd = newQuantity * newPrice;

    // Update the item
    const [updatedItem] = await db
      .update(privateClientOrderItems)
      .set(updateData)
      .where(eq(privateClientOrderItems.id, itemId))
      .returning();

    // Recalculate order totals
    await recalculateOrderTotals(item.order.id);

    return updatedItem;
  });

export default adminUpdateItem;
