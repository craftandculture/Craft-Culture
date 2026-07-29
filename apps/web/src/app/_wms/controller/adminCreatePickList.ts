import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  privateClientOrderItems,
  privateClientOrders,
  wmsPickListItems,
  wmsPickLists,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { createPickListSchema } from '../schemas/pickListSchema';
import generatePickListNumber from '../utils/generatePickListNumber';
import resolvePickStock from '../utils/resolvePickStock';

/**
 * Create a pick list from an order
 * Generates suggested pick locations based on available stock
 *
 * @example
 *   await trpcClient.wms.admin.picking.create.mutate({
 *     orderId: "uuid"
 *   });
 */
const adminCreatePickList = wmsOperatorProcedure
  .input(createPickListSchema)
  .mutation(async ({ input }) => {
    const { orderId } = input;

    // Get the order
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

    // Check if pick list already exists for this order
    const [existingPickList] = await db
      .select()
      .from(wmsPickLists)
      .where(eq(wmsPickLists.orderId, orderId));

    if (existingPickList) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Pick list ${existingPickList.pickListNumber} already exists for this order`,
      });
    }

    // Get order items
    const orderItems = await db
      .select()
      .from(privateClientOrderItems)
      .where(eq(privateClientOrderItems.orderId, orderId));

    if (orderItems.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Order has no items',
      });
    }

    // Generate pick list number
    const pickListNumber = await generatePickListNumber();

    // Create pick list
    const [pickList] = await db
      .insert(wmsPickLists)
      .values({
        pickListNumber,
        orderId,
        orderNumber: order.orderNumber,
        totalItems: orderItems.length,
        pickedItems: 0,
      })
      .returning();

    // Create pick list items with suggested locations
    const pickListItems = [];

    for (const item of orderItems) {
      // PCO line fields are `lwin`/`quantity` (not lwin18/quantityCases).
      // Pack-agnostic, in-stock-only match by LWIN7+vintage with a safe name
      // fallback — never pins an empty pack or a lookalike cuvée.
      const neededCases = item.quantity ?? 0;
      const suggestedStock = await resolvePickStock({
        lwin18: item.lwin,
        productName: item.productName,
        neededCases,
        db,
      });

      const [pickListItem] = await db
        .insert(wmsPickListItems)
        .values({
          pickListId: pickList.id,
          lwin18: suggestedStock?.lwin18 ?? item.lwin ?? '',
          productName: item.productName,
          quantityCases: neededCases,
          suggestedLocationId: suggestedStock?.locationId ?? null,
          suggestedStockId: suggestedStock?.stockId ?? null,
          notes:
            suggestedStock?.matchedBy === 'name'
              ? 'VERIFY: matched by name (no LWIN match) — confirm the wine'
              : null,
        })
        .returning();

      pickListItems.push(pickListItem);
    }

    return {
      success: true,
      pickList,
      items: pickListItems,
      message: `Pick list ${pickListNumber} created with ${pickListItems.length} items`,
    };
  });

export default adminCreatePickList;
