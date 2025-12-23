import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import confirmQuoteSchema from '../schemas/confirmQuoteSchema';

/**
 * Confirm a quote after C&C review (admin only)
 *
 * For B2C users: Transitions status from 'under_cc_review' to 'awaiting_payment'
 * For B2B users: Transitions status from 'under_cc_review' to 'cc_confirmed'
 *
 * @example
 *   await trpcClient.quotes.confirm.mutate({
 *     quoteId: "uuid-here",
 *     deliveryLeadTime: "14-21 days",
 *     ccConfirmationNotes: "All items confirmed with suppliers"
 *   });
 */
const quotesConfirm = adminProcedure
  .input(confirmQuoteSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const {
      quoteId,
      deliveryLeadTime,
      ccConfirmationNotes,
      licensedPartnerId,
      paymentMethod,
      paymentDetails,
      lineItemAdjustments,
    } = input;

    // Verify quote exists and get quote owner's customer type
    const [quoteWithUser] = await db
      .select({
        quote: quotes,
        customerType: users.customerType,
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.userId, users.id))
      .where(eq(quotes.id, quoteId))
      .limit(1);

    if (!quoteWithUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    const existingQuote = quoteWithUser.quote;
    const isB2C = quoteWithUser.customerType === 'b2c';

    // Verify quote is in correct status
    if (existingQuote.status !== 'under_cc_review') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot confirm quote with status '${existingQuote.status}'`,
      });
    }

    // B2C requires payment configuration
    if (isB2C && (!licensedPartnerId || !paymentMethod)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'B2C quotes require licensed partner and payment configuration',
      });
    }

    try {
      // Prepare update data
      // B2C: awaiting_payment (customer pays licensed partner)
      // B2B: cc_confirmed (customer submits PO)
      const updateData: {
        status: 'awaiting_payment' | 'cc_confirmed';
        ccConfirmedAt: Date;
        ccConfirmedBy: string;
        deliveryLeadTime: string;
        ccConfirmationNotes?: string;
        licensedPartnerId?: string;
        paymentMethod?: 'bank_transfer' | 'link';
        paymentDetails?: typeof paymentDetails;
        quoteData?: unknown;
        totalUsd?: number;
        totalAed?: number;
      } = {
        status: isB2C ? 'awaiting_payment' : 'cc_confirmed',
        ccConfirmedAt: new Date(),
        ccConfirmedBy: user.id,
        deliveryLeadTime,
        ccConfirmationNotes,
        // Only set payment fields for B2C
        ...(isB2C && licensedPartnerId && {
          licensedPartnerId,
          paymentMethod,
          paymentDetails,
        }),
      };

      // If we have adjustments, update the quote data and recalculate totals
      if (lineItemAdjustments && Object.keys(lineItemAdjustments).length > 0) {
        const existingData = (existingQuote.quoteData as { lineItems?: unknown[] }) || {};
        const lineItems = (existingQuote.lineItems as Array<{ productId: string; quantity: number }>) || [];

        // Type for adjustments from schema
        type LineItemAdjustment = {
          adjustedPricePerCase?: number;
          confirmedQuantity?: number;
          available: boolean;
          notes?: string;
          adminAlternatives?: Array<{
            productName: string;
            pricePerCase: number;
            bottlesPerCase: number;
            bottleSize: string;
            quantityAvailable: number;
          }>;
        };

        // Update line item pricing with adjustments
        const updatedLineItemPricing = lineItems
          .map((item) => {
            const adjustment = lineItemAdjustments[item.productId] as LineItemAdjustment | undefined;
            if (!adjustment || !adjustment.available) {
              return null; // Item marked as unavailable
            }

            const pricePerCase = adjustment.adjustedPricePerCase || 0;
            const quantity = adjustment.confirmedQuantity || item.quantity;
            const lineItemTotalUsd = pricePerCase * quantity;

            return {
              productId: item.productId,
              lineItemTotalUsd,
              basePriceUsd: pricePerCase,
              confirmedQuantity: quantity,
              originalQuantity: item.quantity,
              adminNotes: adjustment.notes,
              adminAlternatives: adjustment.adminAlternatives,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null); // Remove unavailable items

        // Calculate new total
        const newTotalUsd = updatedLineItemPricing.reduce(
          (sum, item) => sum + item.lineItemTotalUsd,
          0,
        );

        updateData.quoteData = {
          ...existingData,
          lineItems: updatedLineItemPricing,
          adminAdjustments: lineItemAdjustments,
        };
        updateData.totalUsd = newTotalUsd;
        updateData.totalAed = newTotalUsd * 3.67; // AED exchange rate
      }

      const [updatedQuote] = await db
        .update(quotes)
        .set(updateData)
        .where(eq(quotes.id, quoteId))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to confirm quote',
        });
      }

      // Send notification to quote owner (fire and forget)
      const { default: notifyUserOfQuoteConfirmation } = await import(
        '../utils/notifyUserOfQuoteConfirmation'
      );
      notifyUserOfQuoteConfirmation(updatedQuote).catch((error) =>
        console.error('Failed to send quote confirmation notification:', error),
      );

      // TODO: Log admin activity

      return updatedQuote;
    } catch (error) {
      console.error('Error confirming quote:', { error, quoteId, adminId: user.id });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to confirm quote',
      });
    }
  });

export default quotesConfirm;
