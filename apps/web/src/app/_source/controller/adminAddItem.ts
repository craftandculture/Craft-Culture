import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqItems, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import addItemSchema from '../schemas/addItemSchema';

/**
 * Add an item to a SOURCE RFQ
 *
 * @example
 *   await trpcClient.source.admin.addItem.mutate({
 *     rfqId: "uuid-here",
 *     productName: "Opus One 2018",
 *     producer: "Opus One",
 *     vintage: "2018",
 *     quantity: 10
 *   });
 */
const adminAddItem = adminProcedure
  .input(addItemSchema)
  .mutation(async ({ input }) => {
    const { rfqId, ...itemData } = input;

    // Verify RFQ exists and is in editable state
    const [rfq] = await db
      .select({ id: sourceRfqs.id, status: sourceRfqs.status, itemCount: sourceRfqs.itemCount })
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!rfq) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    // Allow adding items until quote is finalized
    // Admin may need to add last-minute items from client requests
    const editableStatuses = ['draft', 'parsing', 'ready_to_send', 'sent', 'collecting', 'comparing', 'selecting'];
    if (!editableStatuses.includes(rfq.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot add items to RFQ that has been finalized or cancelled',
      });
    }

    // Create the item
    const [item] = await db
      .insert(sourceRfqItems)
      .values({
        rfqId,
        productName: itemData.productName,
        producer: itemData.producer,
        vintage: itemData.vintage,
        region: itemData.region,
        country: itemData.country,
        bottleSize: itemData.bottleSize,
        caseConfig: itemData.caseConfig,
        lwin: itemData.lwin,
        quantity: itemData.quantity,
        originalText: itemData.originalText,
        parseConfidence: itemData.parseConfidence,
        adminNotes: itemData.adminNotes,
        sortOrder: rfq.itemCount,
      })
      .returning();

    if (!item) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to add item',
      });
    }

    // Update item count on RFQ
    await db
      .update(sourceRfqs)
      .set({ itemCount: sql`${sourceRfqs.itemCount} + 1` })
      .where(eq(sourceRfqs.id, rfqId));

    return item;
  });

export default adminAddItem;
