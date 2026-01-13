import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const removeLineItemSchema = z.object({
  quoteId: z.string().uuid(),
  productId: z.string(),
});

/**
 * Remove a line item from a quote
 *
 * Allows customer to remove a line item before payment is completed.
 * Only allowed for quotes in cc_confirmed or awaiting_payment status.
 *
 * @example
 *   await trpcClient.quotes.removeLineItem.mutate({
 *     quoteId: "uuid-here",
 *     productId: "product-123"
 *   });
 */
const quotesRemoveLineItem = protectedProcedure
  .input(removeLineItemSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { quoteId, productId } = input;

    // Verify quote exists and belongs to user
    const [existingQuote] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, quoteId))
      .limit(1);

    if (!existingQuote) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    if (existingQuote.userId !== user.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to modify this quote',
      });
    }

    // Can only remove line items when quote is confirmed but not yet paid
    const allowedStatuses = ['cc_confirmed', 'awaiting_payment'];
    if (!allowedStatuses.includes(existingQuote.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot remove line items from quote with status '${existingQuote.status}'`,
      });
    }

    try {
      // Get current line items
      const currentLineItems = (existingQuote.lineItems as Array<{
        productId: string;
        offerId: string;
        quantity: number;
      }>) || [];

      // Filter out the line item to remove
      const updatedLineItems = currentLineItems.filter(
        (item) => item.productId !== productId,
      );

      if (updatedLineItems.length === currentLineItems.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Line item not found',
        });
      }

      // Prevent removing all line items
      if (updatedLineItems.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot remove all line items from quote',
        });
      }

      // Update quoteData pricing if it exists
      const quoteData = (existingQuote.quoteData as {
        lineItems?: Array<{
          productId: string;
          lineItemTotalUsd: number;
          basePriceUsd?: number;
          confirmedQuantity?: number;
          originalQuantity?: number;
          adminNotes?: string;
          adminAlternatives?: unknown[];
          acceptedAlternative?: unknown;
        }>;
        adminAdjustments?: unknown;
      }) || {};

      let updatedQuoteData = quoteData;
      let newTotalUsd = existingQuote.totalUsd;

      if (quoteData.lineItems) {
        const updatedPricingLineItems = quoteData.lineItems.filter(
          (item) => item.productId !== productId,
        );

        // Recalculate total
        newTotalUsd = updatedPricingLineItems.reduce(
          (sum, item) => sum + item.lineItemTotalUsd,
          0,
        );

        updatedQuoteData = {
          ...quoteData,
          lineItems: updatedPricingLineItems,
        };
      }

      // Update quote
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          lineItems: updatedLineItems,
          quoteData: updatedQuoteData,
          totalUsd: newTotalUsd,
          totalAed: newTotalUsd * 3.67, // AED exchange rate
        })
        .where(eq(quotes.id, quoteId))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove line item',
        });
      }

      return updatedQuote;
    } catch (error) {
      logger.error('Error removing line item', { error, quoteId, productId });

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to remove line item',
      });
    }
  });

export default quotesRemoveLineItem;
