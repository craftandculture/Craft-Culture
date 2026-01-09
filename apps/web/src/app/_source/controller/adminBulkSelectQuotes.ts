import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourceRfqItems, sourceRfqQuotes, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const bulkSelectQuotesSchema = z.object({
  rfqId: z.string().uuid(),
  selections: z.array(
    z.object({
      itemId: z.string().uuid(),
      quoteId: z.string().uuid(),
    }),
  ),
  clearAll: z.boolean().optional(),
});

/**
 * Bulk select quotes for multiple RFQ items at once
 * Used for auto-select best, select all from partner, or clear all
 *
 * @example
 *   await trpcClient.source.admin.bulkSelectQuotes.mutate({
 *     rfqId: "rfq-uuid",
 *     selections: [
 *       { itemId: "item-1", quoteId: "quote-1" },
 *       { itemId: "item-2", quoteId: "quote-2" },
 *     ]
 *   });
 */
const adminBulkSelectQuotes = adminProcedure
  .input(bulkSelectQuotesSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { rfqId, selections, clearAll } = input;

    // Verify RFQ exists and is in a selectable state
    const [rfq] = await db
      .select()
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!rfq) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    const selectableStatuses = ['sent', 'collecting', 'comparing', 'selecting'];
    if (!selectableStatuses.includes(rfq.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'RFQ is not in a state where quotes can be selected',
      });
    }

    // Get all items for this RFQ
    const items = await db
      .select({ id: sourceRfqItems.id })
      .from(sourceRfqItems)
      .where(eq(sourceRfqItems.rfqId, rfqId));

    const itemIds = items.map((i) => i.id);

    if (itemIds.length === 0) {
      return { updated: 0 };
    }

    // Clear all selections if requested
    if (clearAll) {
      // Unselect all quotes
      await db
        .update(sourceRfqQuotes)
        .set({ isSelected: false })
        .where(inArray(sourceRfqQuotes.itemId, itemIds));

      // Reset all items
      await db
        .update(sourceRfqItems)
        .set({
          selectedQuoteId: null,
          selectedAt: null,
          selectedBy: null,
          status: 'pending',
          calculatedPriceUsd: null,
          finalPriceUsd: null,
          priceAdjustedBy: null,
        })
        .where(eq(sourceRfqItems.rfqId, rfqId));

      return { updated: itemIds.length, cleared: true };
    }

    // Process selections
    const now = new Date();
    let updatedCount = 0;

    for (const selection of selections) {
      const { itemId, quoteId } = selection;

      // Verify quote exists and belongs to this item
      const [quote] = await db
        .select()
        .from(sourceRfqQuotes)
        .where(eq(sourceRfqQuotes.id, quoteId));

      if (!quote || quote.itemId !== itemId) {
        continue; // Skip invalid selections
      }

      // Unselect any previously selected quote for this item
      await db
        .update(sourceRfqQuotes)
        .set({ isSelected: false })
        .where(eq(sourceRfqQuotes.itemId, itemId));

      // Select the new quote
      await db
        .update(sourceRfqQuotes)
        .set({ isSelected: true })
        .where(eq(sourceRfqQuotes.id, quoteId));

      // Update the item with selection info
      await db
        .update(sourceRfqItems)
        .set({
          selectedQuoteId: quoteId,
          selectedAt: now,
          selectedBy: user.id,
          status: 'selected',
          calculatedPriceUsd: quote.costPricePerCaseUsd,
          finalPriceUsd: quote.costPricePerCaseUsd,
          priceAdjustedBy: null,
        })
        .where(eq(sourceRfqItems.id, itemId));

      updatedCount++;
    }

    // Update RFQ status to selecting
    await db
      .update(sourceRfqs)
      .set({ status: 'selecting' })
      .where(eq(sourceRfqs.id, rfqId));

    return { updated: updatedCount };
  });

export default adminBulkSelectQuotes;
