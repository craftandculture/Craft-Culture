import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { partners, quotes, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import convertUsdToAed from '@/utils/convertUsdToAed';
import logger from '@/utils/logger';

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
      lineItemAdjustments,
      oocFulfillments,
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

    // Payment details always come from the selected partner's own record,
    // never from the browser: the customer pays into these.
    let paymentDetails:
      | NonNullable<typeof partners.$inferSelect.paymentDetails>
      | undefined;

    if (isB2C && licensedPartnerId && paymentMethod) {
      const [partner] = await db
        .select({ id: partners.id, paymentDetails: partners.paymentDetails })
        .from(partners)
        .where(eq(partners.id, licensedPartnerId))
        .limit(1);

      if (!partner) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Licensed partner not found',
        });
      }

      const stored = partner.paymentDetails ?? {};

      if (paymentMethod === 'bank_transfer') {
        if (!stored.accountName || !stored.iban) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'This partner has no bank details on file (account name and IBAN are required)',
          });
        }

        paymentDetails = {
          bankName: stored.bankName,
          accountName: stored.accountName,
          accountNumber: stored.accountNumber,
          sortCode: stored.sortCode,
          iban: stored.iban,
          swiftBic: stored.swiftBic,
        };
      } else {
        if (!stored.paymentUrl) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This partner has no payment link on file',
          });
        }

        paymentDetails = { paymentUrl: stored.paymentUrl };
      }
    }

    // Adjustments must refer to products on this quote; a stray key usually
    // means the dialog carried state over from a different quote.
    const quoteProductIds = new Set(
      ((existingQuote.lineItems as Array<{ productId: string }>) || []).map(
        (item) => item.productId,
      ),
    );
    const strayKeys = Object.keys(lineItemAdjustments ?? {}).filter(
      (key) => !quoteProductIds.has(key),
    );

    if (strayKeys.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'The review contains wines that are not on this quote. Close the dialog, reopen the quote and try again.',
      });
    }

    // Generate unique payment reference for B2C quotes
    const generatePaymentReference = () => {
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `CC-${timestamp.slice(-4)}${random}`;
    };

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
          paymentDetails: {
            ...paymentDetails,
            // Auto-generate unique payment reference
            reference: generatePaymentReference(),
          },
        }),
      };

      // If we have adjustments or OOC fulfillments, update the quote data and recalculate totals
      if (
        (lineItemAdjustments && Object.keys(lineItemAdjustments).length > 0) ||
        (oocFulfillments && oocFulfillments.length > 0)
      ) {
        const existingData =
          (existingQuote.quoteData as {
            lineItems?: Array<{ productId: string; basePriceUsd?: number }>;
            outOfCatalogueRequests?: unknown[];
          }) || {};
        const existingPricing = new Map(
          (existingData.lineItems ?? []).map((item) => [item.productId, item]),
        );
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
        // Keep all items (including unavailable ones) to preserve alternatives data
        const updatedLineItemPricing = lineItems
          .map((item) => {
            const adjustment = lineItemAdjustments?.[item.productId] as LineItemAdjustment | undefined;

            // A line without an adjustment keeps its quoted price and is
            // available; only an explicit available:false removes it
            const isAvailable = adjustment ? adjustment.available : true;
            const quotedPricePerCase = existingPricing.get(item.productId)?.basePriceUsd ?? 0;

            // For unavailable items, set price/quantity to 0 but preserve alternatives
            const pricePerCase = isAvailable
              ? (adjustment?.adjustedPricePerCase ?? quotedPricePerCase)
              : 0;
            const quantity = isAvailable ? (adjustment?.confirmedQuantity || item.quantity) : 0;
            const lineItemTotalUsd = pricePerCase * quantity;

            return {
              productId: item.productId,
              lineItemTotalUsd,
              basePriceUsd: pricePerCase,
              confirmedQuantity: quantity,
              originalQuantity: item.quantity,
              adminNotes: adjustment?.notes,
              adminAlternatives: adjustment?.adminAlternatives,
              available: isAvailable, // Track availability status
            };
          })

        // Calculate regular line items total
        const lineItemsTotalUsd = updatedLineItemPricing.reduce(
          (sum, item) => sum + item.lineItemTotalUsd,
          0,
        );

        // Calculate OOC fulfillments total
        const oocTotalUsd = oocFulfillments?.reduce(
          (sum, item) => sum + item.pricePerCase * item.quantity,
          0,
        ) || 0;

        // Combined total
        const newTotalUsd = lineItemsTotalUsd + oocTotalUsd;

        updateData.quoteData = {
          ...existingData,
          lineItems: updatedLineItemPricing,
          adminAdjustments: lineItemAdjustments,
          // Store fulfilled OOC items with pricing
          fulfilledOocItems: oocFulfillments?.map((item) => ({
            ...item,
            lineItemTotalUsd: item.pricePerCase * item.quantity,
          })),
        };
        updateData.totalUsd = newTotalUsd;
        updateData.totalAed = convertUsdToAed(newTotalUsd);
      }

      const [updatedQuote] = await db
        .update(quotes)
        .set(updateData)
        .where(and(eq(quotes.id, quoteId), eq(quotes.status, 'under_cc_review')))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This quote has already been confirmed or changed. Please reload.',
        });
      }

      // Send notification to quote owner (fire and forget)
      const { default: notifyUserOfQuoteConfirmation } = await import(
        '../utils/notifyUserOfQuoteConfirmation'
      );
      notifyUserOfQuoteConfirmation(updatedQuote).catch((error) =>
        logger.error('Failed to send quote confirmation notification', { error }),
      );

      // Log admin activity
      void logAdminActivity({
        adminId: user.id,
        action: 'quote.approved',
        entityType: 'quote',
        entityId: updatedQuote.id,
        metadata: {
          quoteName: updatedQuote.name,
          clientName: updatedQuote.clientName,
          customerType: isB2C ? 'b2c' : 'b2b',
          newStatus: updateData.status,
        },
      });

      return updatedQuote;
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      logger.error('Error confirming quote', { error, quoteId, adminId: user.id });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to confirm quote',
      });
    }
  });

export default quotesConfirm;
