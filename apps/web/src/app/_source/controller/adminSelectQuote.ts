import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqItems, sourceRfqQuotes, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import selectQuoteSchema from '../schemas/selectQuoteSchema';

/**
 * Toggle quote selection for an RFQ item
 * Supports multi-selection - can select multiple quotes per item (e.g., different vintages)
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
    const { itemId, quoteId } = input;

    // Verify quote exists and belongs to this item
    const [quoteResult] = await db
      .select({
        quote: sourceRfqQuotes,
        rfqId: sourceRfqItems.rfqId,
        rfqStatus: sourceRfqs.status,
      })
      .from(sourceRfqQuotes)
      .innerJoin(sourceRfqItems, eq(sourceRfqQuotes.itemId, sourceRfqItems.id))
      .innerJoin(sourceRfqs, eq(sourceRfqItems.rfqId, sourceRfqs.id))
      .where(eq(sourceRfqQuotes.id, quoteId));

    if (!quoteResult) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    if (quoteResult.quote.itemId !== itemId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Quote does not belong to this item',
      });
    }

    // Check RFQ is in a state where selection is allowed
    const selectableStatuses = ['sent', 'collecting', 'comparing', 'selecting'];
    if (!selectableStatuses.includes(quoteResult.rfqStatus)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'RFQ is not in a state where quotes can be selected',
      });
    }

    // Toggle behavior: if already selected, unselect; otherwise select
    const isCurrentlySelected = quoteResult.quote.isSelected;

    if (isCurrentlySelected) {
      // Unselect this quote
      await db
        .update(sourceRfqQuotes)
        .set({ isSelected: false })
        .where(eq(sourceRfqQuotes.id, quoteId));
    } else {
      // Prevent selecting N/A quotes (they have no price)
      if (quoteResult.quote.quoteType === 'not_available' || quoteResult.quote.costPricePerCaseUsd === null) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot select a quote that is marked as not available',
        });
      }

      // Select this quote (don't unselect others - allow multi-selection)
      await db
        .update(sourceRfqQuotes)
        .set({ isSelected: true })
        .where(eq(sourceRfqQuotes.id, quoteId));
    }

    // Get all selected quotes for this item to calculate totals
    const selectedQuotes = await db
      .select()
      .from(sourceRfqQuotes)
      .where(
        and(
          eq(sourceRfqQuotes.itemId, itemId),
          eq(sourceRfqQuotes.isSelected, true)
        )
      );

    // Calculate total price from all selected quotes
    const totalPrice = selectedQuotes.reduce(
      (sum, q) => sum + (q.costPricePerCaseUsd ?? 0),
      0
    );

    // Update item status based on selections
    const now = new Date();
    const hasSelections = selectedQuotes.length > 0;
    const primaryQuoteId = selectedQuotes[0]?.id ?? null;

    const [updatedItem] = await db
      .update(sourceRfqItems)
      .set({
        selectedQuoteId: primaryQuoteId, // Keep first selection as primary for backwards compat
        selectedAt: hasSelections ? now : null,
        selectedBy: hasSelections ? user.id : null,
        status: hasSelections ? 'selected' : 'quoted',
        calculatedPriceUsd: hasSelections ? totalPrice : null,
        finalPriceUsd: hasSelections ? totalPrice : null,
        priceAdjustedBy: null,
      })
      .where(eq(sourceRfqItems.id, itemId))
      .returning();

    // Update RFQ status to selecting if not already
    await db
      .update(sourceRfqs)
      .set({ status: 'selecting' })
      .where(eq(sourceRfqs.id, quoteResult.rfqId));

    return {
      ...updatedItem,
      selectedCount: selectedQuotes.length,
    };
  });

export default adminSelectQuote;
