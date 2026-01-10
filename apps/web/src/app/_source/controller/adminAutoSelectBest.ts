import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourceRfqItems, sourceRfqQuotes, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const autoSelectBestSchema = z.object({
  rfqId: z.string().uuid(),
  strategy: z.enum(['lowest_price', 'single_partner']).default('lowest_price'),
  partnerId: z.string().uuid().optional(),
});

/**
 * Auto-select the best quotes for all RFQ items
 *
 * Strategies:
 * - lowest_price: Select the cheapest quote for each item
 * - single_partner: Select all quotes from one partner
 *
 * @example
 *   await trpcClient.source.admin.autoSelectBest.mutate({
 *     rfqId: "rfq-uuid",
 *     strategy: "lowest_price"
 *   });
 */
const adminAutoSelectBest = adminProcedure
  .input(autoSelectBestSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { rfqId, strategy, partnerId } = input;

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

    if (items.length === 0) {
      return { updated: 0, message: 'No items to select' };
    }

    const itemIds = items.map((i) => i.id);

    // Get all quotes for these items
    const allQuotes = await db
      .select({
        id: sourceRfqQuotes.id,
        itemId: sourceRfqQuotes.itemId,
        partnerId: sourceRfqQuotes.partnerId,
        costPricePerCaseUsd: sourceRfqQuotes.costPricePerCaseUsd,
        quoteType: sourceRfqQuotes.quoteType,
      })
      .from(sourceRfqQuotes)
      .where(inArray(sourceRfqQuotes.itemId, itemIds));

    // Filter to valid quotes only (have price and are exact/alternative, not N/A)
    const validQuotes = allQuotes.filter(
      (q) =>
        q.costPricePerCaseUsd !== null &&
        q.quoteType !== 'not_available',
    );

    if (validQuotes.length === 0) {
      return { updated: 0, message: 'No valid quotes to select' };
    }

    // Build selections based on strategy
    const selections: Array<{
      itemId: string;
      quoteId: string;
      price: number;
    }> = [];

    if (strategy === 'lowest_price') {
      // Group quotes by item
      const quotesByItem = new Map<
        string,
        Array<{ id: string; price: number }>
      >();

      for (const quote of validQuotes) {
        const itemQuotes = quotesByItem.get(quote.itemId) || [];
        itemQuotes.push({
          id: quote.id,
          price: Number(quote.costPricePerCaseUsd!),
        });
        quotesByItem.set(quote.itemId, itemQuotes);
      }

      // Select lowest price for each item
      for (const [itemId, quotes] of quotesByItem) {
        const sorted = quotes.sort((a, b) => a.price - b.price);
        const best = sorted[0];
        if (best) {
          selections.push({ itemId, quoteId: best.id, price: best.price });
        }
      }
    } else if (strategy === 'single_partner') {
      if (!partnerId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Partner ID required for single_partner strategy',
        });
      }

      // Select all quotes from the specified partner
      const partnerQuotes = validQuotes.filter((q) => q.partnerId === partnerId);

      for (const quote of partnerQuotes) {
        selections.push({
          itemId: quote.itemId,
          quoteId: quote.id,
          price: Number(quote.costPricePerCaseUsd!),
        });
      }
    }

    if (selections.length === 0) {
      return { updated: 0, message: 'No selections made' };
    }

    const now = new Date();
    const selectionItemIds = selections.map((s) => s.itemId);
    const selectionQuoteIds = selections.map((s) => s.quoteId);

    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      // 1. Unselect all existing quotes for these items
      await tx
        .update(sourceRfqQuotes)
        .set({ isSelected: false })
        .where(inArray(sourceRfqQuotes.itemId, selectionItemIds));

      // 2. Select new quotes
      await tx
        .update(sourceRfqQuotes)
        .set({ isSelected: true })
        .where(inArray(sourceRfqQuotes.id, selectionQuoteIds));

      // 3. Update items with selection info
      for (const selection of selections) {
        await tx
          .update(sourceRfqItems)
          .set({
            selectedQuoteId: selection.quoteId,
            selectedAt: now,
            selectedBy: user.id,
            status: 'selected',
            calculatedPriceUsd: selection.price,
            finalPriceUsd: selection.price,
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

    // Calculate total value
    const totalValue = selections.reduce((sum, s) => sum + s.price, 0);

    return {
      updated: selections.length,
      totalItems: items.length,
      totalValue: totalValue.toFixed(2),
      strategy,
    };
  });

export default adminAutoSelectBest;
