import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrderItems, privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import addItemSchema from '../schemas/addItemSchema';
import recalculateOrderTotals from '../utils/recalculateOrderTotals';

/**
 * Add a line item to a private client order
 *
 * Only the owning wine partner can add items. Order must be in draft status.
 * Automatically recalculates order totals.
 */
const itemsAdd = winePartnerProcedure
  .input(addItemSchema)
  .mutation(async ({ input, ctx: { partnerId } }) => {
    const { orderId, quantity, pricePerCaseUsd, ...itemData } = input;

    // Verify order exists, belongs to this partner, and is editable
    const [order] = await db
      .select()
      .from(privateClientOrders)
      .where(
        and(
          eq(privateClientOrders.id, orderId),
          eq(privateClientOrders.partnerId, partnerId),
        ),
      );

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

export default itemsAdd;
