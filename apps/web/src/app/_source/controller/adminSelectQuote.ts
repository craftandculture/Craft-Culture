import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqItems, sourceRfqQuotes, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import selectQuoteSchema from '../schemas/selectQuoteSchema';

/**
 * Select a winning quote for an RFQ item
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
