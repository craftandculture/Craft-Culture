import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqItems, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import updateItemSchema from '../schemas/updateItemSchema';

/**
 * Update a SOURCE RFQ item
 *
 * @example
 *   await trpcClient.source.admin.updateItem.mutate({
 *     itemId: "uuid-here",
 *     productName: "Corrected Name",
 *     quantity: 12,
 *     finalPriceUsd: 150.00
 *   });
 */
const adminUpdateItem = adminProcedure
  .input(updateItemSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { itemId, ...updateData } = input;

    // Verify item exists and get RFQ
    const [existing] = await db
      .select({
        item: sourceRfqItems,
        rfqStatus: sourceRfqs.status,
      })
      .from(sourceRfqItems)
      .innerJoin(sourceRfqs, eq(sourceRfqItems.rfqId, sourceRfqs.id))
      .where(eq(sourceRfqItems.id, itemId));

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Item not found',
      });
    }

    // Build update object
    const updates: Record<string, unknown> = {};

    if (updateData.productName !== undefined) updates.productName = updateData.productName;
    if (updateData.producer !== undefined) updates.producer = updateData.producer;
    if (updateData.vintage !== undefined) updates.vintage = updateData.vintage;
    if (updateData.region !== undefined) updates.region = updateData.region;
    if (updateData.country !== undefined) updates.country = updateData.country;
    if (updateData.bottleSize !== undefined) updates.bottleSize = updateData.bottleSize;
    if (updateData.caseConfig !== undefined) updates.caseConfig = updateData.caseConfig;
    if (updateData.lwin !== undefined) updates.lwin = updateData.lwin;
    if (updateData.quantity !== undefined) updates.quantity = updateData.quantity;
    if (updateData.adminNotes !== undefined) updates.adminNotes = updateData.adminNotes;

    // Handle final price adjustment (track who adjusted)
    if (updateData.finalPriceUsd !== undefined) {
      if (updateData.finalPriceUsd === null) {
        // Reset to cost price
        updates.finalPriceUsd = null;
        updates.priceAdjustedBy = null;
      } else {
        updates.finalPriceUsd = updateData.finalPriceUsd;
        updates.priceAdjustedBy = user.id;
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No fields to update',
      });
    }

    const [item] = await db
      .update(sourceRfqItems)
      .set(updates)
      .where(eq(sourceRfqItems.id, itemId))
      .returning();

    return item;
  });

export default adminUpdateItem;
