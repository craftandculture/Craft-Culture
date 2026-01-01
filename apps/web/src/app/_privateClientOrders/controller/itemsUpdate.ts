import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderItems, privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const updateItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive().optional(),
  pricePerCaseUsd: z.number().positive().optional(),
  notes: z.string().optional(),
});

/**
 * Update a line item in a private client order
 *
 * Partners can update items in their own orders that are in draft or revision_requested status.
 */
const itemsUpdate = winePartnerProcedure.input(updateItemSchema).mutation(async ({ input, ctx }) => {
  const { itemId, quantity, pricePerCaseUsd, notes } = input;
  const { partnerId } = ctx;

  // Fetch the item with its order
  const item = await db.query.privateClientOrderItems.findFirst({
    where: { id: itemId },
    with: {
      order: {
        columns: { id: true, partnerId: true, status: true },
      },
    },
  });

  if (!item) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Item not found',
    });
  }

  // Verify ownership
  if (item.order.partnerId !== partnerId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to update this item',
    });
  }

  // Check order status allows editing
  const editableStatuses = ['draft', 'revision_requested'];
  if (!editableStatuses.includes(item.order.status)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cannot edit items in an order that has been submitted for review',
    });
  }

  // Build update object
  const updateData: {
    quantity?: number;
    pricePerCaseUsd?: number;
    totalUsd?: number;
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
  const allItems = await db.query.privateClientOrderItems.findMany({
    where: { orderId: item.order.id },
  });

  const subtotalUsd = allItems.reduce((sum, i) => sum + Number(i.totalUsd), 0);
  const caseCount = allItems.reduce((sum, i) => sum + i.quantity, 0);

  await db
    .update(privateClientOrders)
    .set({
      subtotalUsd,
      caseCount,
      itemCount: allItems.length,
      updatedAt: new Date(),
    })
    .where(eq(privateClientOrders.id, item.order.id));

  return updatedItem;
});

export default itemsUpdate;
