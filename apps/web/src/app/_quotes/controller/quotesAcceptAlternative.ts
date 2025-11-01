import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import acceptAlternativeSchema from '../schemas/acceptAlternativeSchema';

/**
 * Accept an alternative product suggestion
 *
 * Allows customer to accept an admin-suggested alternative product,
 * which will update the line item pricing and product details
 *
 * @example
 *   await trpcClient.quotes.acceptAlternative.mutate({
 *     quoteId: "uuid-here",
 *     productId: "product-123",
 *     alternativeIndex: 0
 *   });
 */
const quotesAcceptAlternative = protectedProcedure
  .input(acceptAlternativeSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { quoteId, productId, alternativeIndex } = input;

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

    // Can only accept alternatives when quote is confirmed
    if (existingQuote.status !== 'cc_confirmed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot accept alternatives for quote with status '${existingQuote.status}'`,
      });
    }

    try {
      const quoteData = (existingQuote.quoteData as {
        lineItems?: Array<{
          productId: string;
          lineItemTotalUsd: number;
          basePriceUsd?: number;
          confirmedQuantity?: number;
          originalQuantity?: number;
          adminNotes?: string;
          adminAlternatives?: Array<{
            productName: string;
            pricePerCase: number;
            bottlesPerCase: number;
            bottleSize: string;
            quantityAvailable: number;
          }>;
          acceptedAlternative?: {
            productName: string;
            pricePerCase: number;
            bottlesPerCase: number;
            bottleSize: string;
            quantityAvailable: number;
            acceptedAt: string;
          };
        }>;
        adminAdjustments?: unknown;
      }) || {};

      const lineItems = quoteData.lineItems || [];

      // Find the line item
      const lineItemIndex = lineItems.findIndex((item) => item.productId === productId);

      if (lineItemIndex === -1) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Line item not found',
        });
      }

      const lineItem = lineItems[lineItemIndex];

      if (!lineItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Line item not found',
        });
      }

      // Handle removing accepted alternative (alternativeIndex === -1)
      if (alternativeIndex === -1) {
        // Remove the accepted alternative and revert to original pricing
        const updatedLineItem = {
          ...lineItem,
          acceptedAlternative: undefined,
          // Revert to original pricing if available
          basePriceUsd: lineItem.originalQuantity
            ? lineItem.lineItemTotalUsd / lineItem.originalQuantity
            : lineItem.basePriceUsd,
        };

        updatedLineItem.lineItemTotalUsd =
          updatedLineItem.basePriceUsd * (lineItem.confirmedQuantity || lineItem.originalQuantity || 0);

        const updatedLineItems = [...lineItems];
        updatedLineItems[lineItemIndex] = updatedLineItem;

        const newTotalUsd = updatedLineItems.reduce(
          (sum, item) => sum + item.lineItemTotalUsd,
          0,
        );

        const [updatedQuote] = await db
          .update(quotes)
          .set({
            quoteData: {
              ...quoteData,
              lineItems: updatedLineItems,
            },
            totalUsd: newTotalUsd,
            totalAed: newTotalUsd * 3.67,
          })
          .where(eq(quotes.id, quoteId))
          .returning();

        return updatedQuote;
      }

      // Validate alternative exists
      if (!lineItem.adminAlternatives || !lineItem.adminAlternatives[alternativeIndex]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alternative not found',
        });
      }

      // Get the selected alternative
      const selectedAlternative = lineItem.adminAlternatives[alternativeIndex];

      // Update the line item with the accepted alternative
      const updatedLineItem = {
        ...lineItem,
        acceptedAlternative: {
          ...selectedAlternative,
          acceptedAt: new Date().toISOString(),
        },
        // Update pricing to use alternative price
        basePriceUsd: selectedAlternative.pricePerCase,
        // Ensure quantity doesn't exceed available quantity
        confirmedQuantity: Math.min(
          lineItem.confirmedQuantity || lineItem.originalQuantity || 0,
          selectedAlternative.quantityAvailable,
        ),
      };

      // Recalculate line item total
      updatedLineItem.lineItemTotalUsd =
        updatedLineItem.basePriceUsd * updatedLineItem.confirmedQuantity;

      // Update the line items array
      const updatedLineItems = [...lineItems];
      updatedLineItems[lineItemIndex] = updatedLineItem;

      // Recalculate total
      const newTotalUsd = updatedLineItems.reduce(
        (sum, item) => sum + item.lineItemTotalUsd,
        0,
      );

      // Update quote
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          quoteData: {
            ...quoteData,
            lineItems: updatedLineItems,
          },
          totalUsd: newTotalUsd,
          totalAed: newTotalUsd * 3.67, // AED exchange rate
        })
        .where(eq(quotes.id, quoteId))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to accept alternative',
        });
      }

      return updatedQuote;
    } catch (error) {
      console.error('Error accepting alternative:', { error, quoteId, productId, alternativeIndex });

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to accept alternative',
      });
    }
  });

export default quotesAcceptAlternative;
