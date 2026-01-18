import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsQuoteLineItems, logisticsQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import updateQuoteSchema from '../schemas/updateQuoteSchema';

/**
 * Update an existing freight quote
 *
 * Updates quote details and optionally replaces all line items.
 * Only quotes in 'draft' or 'pending' status can be updated.
 */
const adminUpdateQuote = adminProcedure.input(updateQuoteSchema).mutation(async ({ input }) => {
  const { id, lineItems, ...updateData } = input;

  // Get existing quote
  const [existingQuote] = await db
    .select()
    .from(logisticsQuotes)
    .where(eq(logisticsQuotes.id, id))
    .limit(1);

  if (!existingQuote) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Quote not found',
    });
  }

  // Only allow updates to draft or pending quotes
  if (!['draft', 'pending'].includes(existingQuote.status)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot update quote with status "${existingQuote.status}"`,
    });
  }

  try {
    // Update quote
    const [updatedQuote] = await db
      .update(logisticsQuotes)
      .set({
        forwarderName: updateData.forwarderName ?? existingQuote.forwarderName,
        forwarderContact: updateData.forwarderContact ?? existingQuote.forwarderContact,
        forwarderEmail: updateData.forwarderEmail ?? existingQuote.forwarderEmail,
        originCountry: updateData.originCountry ?? existingQuote.originCountry,
        originCity: updateData.originCity ?? existingQuote.originCity,
        destinationCountry: updateData.destinationCountry ?? existingQuote.destinationCountry,
        destinationCity: updateData.destinationCity ?? existingQuote.destinationCity,
        transportMode: updateData.transportMode ?? existingQuote.transportMode,
        totalPrice: updateData.totalPrice ?? existingQuote.totalPrice,
        currency: updateData.currency ?? existingQuote.currency,
        transitDays: updateData.transitDays ?? existingQuote.transitDays,
        validFrom: updateData.validFrom ?? existingQuote.validFrom,
        validUntil: updateData.validUntil ?? existingQuote.validUntil,
        notes: updateData.notes ?? existingQuote.notes,
        internalNotes: updateData.internalNotes ?? existingQuote.internalNotes,
        updatedAt: new Date(),
      })
      .where(eq(logisticsQuotes.id, id))
      .returning();

    // Replace line items if provided
    if (lineItems !== undefined) {
      // Delete existing line items
      await db.delete(logisticsQuoteLineItems).where(eq(logisticsQuoteLineItems.quoteId, id));

      // Insert new line items
      if (lineItems.length > 0) {
        await db.insert(logisticsQuoteLineItems).values(
          lineItems.map((item, index) => ({
            quoteId: id,
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
    }

    logger.info('Updated freight quote', { quoteId: id });

    return updatedQuote;
  } catch (error) {
    logger.error('Failed to update freight quote', { error, quoteId: id });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update quote',
    });
  }
});

export default adminUpdateQuote;
