import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqItems, sourceRfqQuotes, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import selectQuoteSchema from '../schemas/selectQuoteSchema';

/**
 * Select or toggle a winning quote for an RFQ item
 * If the quote is already selected, it will be unselected (toggle behavior)
 *
 * @example
 *   await trpcClient.source.admin.selectQuote.mutate({
 *     itemId: "item-uuid",
 *     quoteId: "quote-uuid",
 *     finalPriceUsd: 125.00
 *   });
 */
const adminSelectQuote = adminProcedure
  .input(selectQuoteSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { itemId, quoteId, finalPriceUsd } = input;

    // Verify quote exists and belongs to this item
    const [quote] = await db
      .select({
        quote: sourceRfqQuotes,
        rfqId: sourceRfqItems.rfqId,
        rfqStatus: sourceRfqs.status,
        currentSelectedQuoteId: sourceRfqItems.selectedQuoteId,
      })
      .from(sourceRfqQuotes)
      .innerJoin(sourceRfqItems, eq(sourceRfqQuotes.itemId, sourceRfqItems.id))
      .innerJoin(sourceRfqs, eq(sourceRfqItems.rfqId, sourceRfqs.id))
      .where(eq(sourceRfqQuotes.id, quoteId));

    if (!quote) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    if (quote.quote.itemId !== itemId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Quote does not belong to this item',
      });
    }

    // Check RFQ is in a state where selection is allowed
    const selectableStatuses = ['sent', 'collecting', 'comparing', 'selecting'];
    if (!selectableStatuses.includes(quote.rfqStatus)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'RFQ is not in a state where quotes can be selected',
      });
    }

    // Toggle behavior: if clicking the same quote that's already selected, unselect it
    const isCurrentlySelected = quote.currentSelectedQuoteId === quoteId;

    if (isCurrentlySelected) {
      // Unselect the quote
      await db
        .update(sourceRfqQuotes)
        .set({ isSelected: false })
        .where(eq(sourceRfqQuotes.id, quoteId));

      // Clear the item selection
      const [updatedItem] = await db
        .update(sourceRfqItems)
        .set({
          selectedQuoteId: null,
          selectedAt: null,
          selectedBy: null,
          status: 'quoted',
          calculatedPriceUsd: null,
          finalPriceUsd: null,
          priceAdjustedBy: null,
        })
        .where(eq(sourceRfqItems.id, itemId))
        .returning();

      return updatedItem;
    }

    // Prevent selecting N/A quotes (they have no price)
    if (quote.quote.quoteType === 'not_available' || quote.quote.costPricePerCaseUsd === null) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot select a quote that is marked as not available',
      });
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
    const now = new Date();
    const [updatedItem] = await db
      .update(sourceRfqItems)
      .set({
        selectedQuoteId: quoteId,
        selectedAt: now,
        selectedBy: user.id,
        status: 'selected',
        // Store calculated price from quote, use override if provided
        calculatedPriceUsd: quote.quote.costPricePerCaseUsd,
        finalPriceUsd: finalPriceUsd ?? quote.quote.costPricePerCaseUsd,
        priceAdjustedBy: finalPriceUsd ? user.id : null,
      })
      .where(eq(sourceRfqItems.id, itemId))
      .returning();

    // Update RFQ status to selecting if not already
    await db
      .update(sourceRfqs)
      .set({ status: 'selecting' })
      .where(eq(sourceRfqs.id, quote.rfqId));

    return updatedItem;
  });

export default adminSelectQuote;
