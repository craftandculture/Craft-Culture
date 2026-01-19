import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { logisticsQuoteLineItems, logisticsQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import createQuoteSchema from '../schemas/createQuoteSchema';
import generateQuoteNumber from '../utils/generateQuoteNumber';

/**
 * Create a new freight quote
 *
 * Creates a quote record with optional line items for detailed cost breakdown.
 * Quote numbers are auto-generated in format QTE-YYYY-XXXX.
 */
const adminCreateQuote = adminProcedure.input(createQuoteSchema).mutation(async ({ input, ctx }) => {
  const { lineItems, ...quoteData } = input;

  try {
    const quoteNumber = await generateQuoteNumber();

    // Create quote
    const [quote] = await db
      .insert(logisticsQuotes)
      .values({
        quoteNumber,
        forwarderName: quoteData.forwarderName,
        forwarderContact: quoteData.forwarderContact || null,
        forwarderEmail: quoteData.forwarderEmail || null,
        shipmentId: quoteData.shipmentId || null,
        requestId: quoteData.requestId || null,
        originCountry: quoteData.originCountry || null,
        originCity: quoteData.originCity || null,
        destinationCountry: quoteData.destinationCountry || null,
        destinationCity: quoteData.destinationCity || null,
        transportMode: quoteData.transportMode || null,
        totalPrice: quoteData.totalPrice,
        currency: quoteData.currency,
        transitDays: quoteData.transitDays || null,
        validFrom: quoteData.validFrom || null,
        validUntil: quoteData.validUntil || null,
        notes: quoteData.notes || null,
        internalNotes: quoteData.internalNotes || null,
        status: 'pending',
        createdBy: ctx.user.id,
      })
      .returning();

    // Create line items if provided
    if (lineItems && lineItems.length > 0) {
      await db.insert(logisticsQuoteLineItems).values(
        lineItems.map((item, index) => ({
          quoteId: quote.id,
          category: item.category,
          description: item.description,
          unitPrice: item.unitPrice || null,
          quantity: item.quantity,
          total: item.total,
          currency: item.currency || null,
          sortOrder: index,
        })),
      );
    }

    logger.info('Created freight quote', {
      quoteId: quote.id,
      quoteNumber,
      forwarder: quoteData.forwarderName,
      createdBy: ctx.user.id,
    });

    return quote;
  } catch (error) {
    logger.error('Failed to create freight quote', { error, input });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create quote',
    });
  }
});

export default adminCreateQuote;
