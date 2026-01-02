import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderItems } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import recalculateOrderTotals from '../utils/recalculateOrderTotals';

const adminUpdateItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive().optional(),
  pricePerCaseUsd: z.number().positive().optional(),
  productName: z.string().min(1).optional(),
  producer: z.string().optional(),
  vintage: z.string().optional(),
  notes: z.string().optional(),
});

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
