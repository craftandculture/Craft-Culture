import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const removeFulfilledOocItemSchema = z.object({
  quoteId: z.string().uuid(),
  requestId: z.string(),
});

/**
 * Remove a fulfilled out-of-catalogue item from a quote
 *
 * Allows customer to remove a special order item before payment is completed.
 * Only allowed for quotes in cc_confirmed or awaiting_payment status.
 *
 * @example
 *   await trpcClient.quotes.removeFulfilledOocItem.mutate({
 *     quoteId: "uuid-here",
 *     requestId: "ooc-123"
 *   });
 */
const quotesRemoveFulfilledOocItem = protectedProcedure
  .input(removeFulfilledOocItemSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { quoteId, requestId } = input;

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

    // Can only remove items when quote is confirmed but not yet paid
    const allowedStatuses = ['cc_confirmed', 'awaiting_payment'];
    if (!allowedStatuses.includes(existingQuote.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot remove items from quote with status '${existingQuote.status}'`,
      });
    }

    try {
      // Get current quote data
      const quoteData = (existingQuote.quoteData as {
        lineItems?: Array<{
          productId: string;
          lineItemTotalUsd: number;
        }>;
        fulfilledOocItems?: Array<{
          requestId: string;
          productName: string;
          vintage?: string;
          quantity: number;
          pricePerCase: number;
          lineItemTotalUsd: number;
        }>;
        outOfCatalogueRequests?: Array<{
          id: string;
          productName: string;
          vintage?: string;
          quantity?: number;
          priceExpectation?: string;
          notes?: string;
        }>;
      }) || {};

      const fulfilledItems = quoteData.fulfilledOocItems || [];

      // Find and remove the item
      const itemToRemove = fulfilledItems.find((item) => item.requestId === requestId);
      if (!itemToRemove) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Special order item not found',
        });
      }

      const updatedFulfilledItems = fulfilledItems.filter(
        (item) => item.requestId !== requestId,
      );

      // Calculate new total
      const lineItemsTotal = (quoteData.lineItems || []).reduce(
        (sum, item) => sum + item.lineItemTotalUsd,
        0,
      );
      const oocTotal = updatedFulfilledItems.reduce(
        (sum, item) => sum + item.lineItemTotalUsd,
        0,
      );
      const newTotalUsd = lineItemsTotal + oocTotal;

      // Update quote data
      const updatedQuoteData = {
        ...quoteData,
        fulfilledOocItems: updatedFulfilledItems,
      };

      // Update quote
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          quoteData: updatedQuoteData,
          totalUsd: newTotalUsd,
          totalAed: newTotalUsd * 3.67,
        })
        .where(eq(quotes.id, quoteId))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove special order item',
        });
      }

      return updatedQuote;
    } catch (error) {
      logger.error('Error removing fulfilled OOC item', { error, quoteId, requestId });

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to remove special order item',
      });
    }
  });

export default quotesRemoveFulfilledOocItem;
