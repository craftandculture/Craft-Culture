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

    // Process selections with batch operations
    const now = new Date();
    const selectionQuoteIds = selections.map((s) => s.quoteId);

    // Verify all quotes exist and match items in one query
    const validQuotes = await db
      .select({
        id: sourceRfqQuotes.id,
        itemId: sourceRfqQuotes.itemId,
        costPricePerCaseUsd: sourceRfqQuotes.costPricePerCaseUsd,
      })
      .from(sourceRfqQuotes)
      .where(inArray(sourceRfqQuotes.id, selectionQuoteIds));

    // Build map for quick lookup
    const quoteMap = new Map(validQuotes.map((q) => [q.id, q]));

    // Filter to valid selections only
    const validSelections = selections.filter((s) => {
      const quote = quoteMap.get(s.quoteId);
      return quote && quote.itemId === s.itemId;
    });

    if (validSelections.length === 0) {
      return { updated: 0 };
    }

    const validItemIds = validSelections.map((s) => s.itemId);
    const validQuoteIds = validSelections.map((s) => s.quoteId);

    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      // 1. Unselect all existing quotes for these items in one query
      await tx
        .update(sourceRfqQuotes)
        .set({ isSelected: false })
        .where(inArray(sourceRfqQuotes.itemId, validItemIds));

      // 2. Select new quotes in one query
      await tx
        .update(sourceRfqQuotes)
        .set({ isSelected: true })
        .where(inArray(sourceRfqQuotes.id, validQuoteIds));

      // 3. Update items with CASE statement for prices
      for (const selection of validSelections) {
        const quote = quoteMap.get(selection.quoteId)!;
        await tx
          .update(sourceRfqItems)
          .set({
            selectedQuoteId: selection.quoteId,
            selectedAt: now,
            selectedBy: user.id,
            status: 'selected',
            calculatedPriceUsd: quote.costPricePerCaseUsd,
            finalPriceUsd: quote.costPricePerCaseUsd,
            priceAdjustedBy: null,
          })
          .where(eq(sourceRfqItems.id, selection.itemId));
      }

      // 4. Update RFQ status to selecting
      await tx
        .update(sourceRfqs)
        .set({ status: 'selecting' })
        .where(eq(sourceRfqs.id, rfqId));
    });

    return { updated: validSelections.length };
  });

export default adminBulkSelectQuotes;
