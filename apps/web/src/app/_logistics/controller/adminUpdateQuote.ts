import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsQuoteLineItems, logisticsQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import updateQuoteSchema from '../schemas/updateQuoteSchema';
import quoteStatusAfterEdit from '../utils/quoteStatusAfterEdit';
import resolveFxToUsd from '../utils/resolveFxToUsd';

/**
 * Update an existing freight quote
 *
 * Updates quote details and optionally replaces all line items, in which case
 * the total is their sum. Only draft, pending and expired quotes can be
 * edited: an expired one whose validity is moved forward (a misread date, or
 * the forwarder confirming it still stands) is live again. The USD total is
 * worked out again whenever the price or currency changes.
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

  // Accepted and rejected quotes are settled; anything else can be put right
  if (!['draft', 'pending', 'expired'].includes(existingQuote.status)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot update quote with status "${existingQuote.status}"`,
    });
  }

  const totalPrice =
    lineItems && lineItems.length > 0
      ? Math.round(lineItems.reduce((sum, item) => sum + item.total, 0) * 100) / 100
      : (updateData.totalPrice ?? existingQuote.totalPrice);
  const currency = (updateData.currency ?? existingQuote.currency).trim().toUpperCase();
  const repriced = totalPrice !== existingQuote.totalPrice || currency !== existingQuote.currency.toUpperCase();
  const fx = repriced ? await resolveFxToUsd(currency) : null;
  const validUntil = updateData.validUntil === undefined ? existingQuote.validUntil : updateData.validUntil;

  try {
    // The quote and its lines change together or not at all
    const updatedQuote = await db.transaction(async (tx) => {
      // Update quote
      const [updated] = await tx
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
          forwarderReference:
            updateData.forwarderReference === undefined
              ? existingQuote.forwarderReference
              : updateData.forwarderReference.trim() || null,
          totalPrice,
          currency,
          ...(fx && {
            fxToUsd: fx.source === 'unresolved' ? null : fx.rate,
            totalUsd: fx.source === 'unresolved' ? null : Math.round(totalPrice * fx.rate * 100) / 100,
          }),
          transitDays: updateData.transitDays ?? existingQuote.transitDays,
          validFrom: updateData.validFrom ?? existingQuote.validFrom,
          validUntil,
          ...(existingQuote.status !== 'draft' && { status: quoteStatusAfterEdit(validUntil) }),
          notes: updateData.notes ?? existingQuote.notes,
          internalNotes: updateData.internalNotes ?? existingQuote.internalNotes,
          updatedAt: new Date(),
        })
        // Still editable at the moment of writing: a quote accepted meanwhile is not changed
        .where(and(eq(logisticsQuotes.id, id), inArray(logisticsQuotes.status, ['draft', 'pending', 'expired'])))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This quote was accepted or rejected meanwhile. Reload to see it.',
        });
      }

      // Replace line items if provided
      if (lineItems !== undefined) {
        // Delete existing line items
        await tx.delete(logisticsQuoteLineItems).where(eq(logisticsQuoteLineItems.quoteId, id));

        // Insert new line items
        if (lineItems.length > 0) {
          await tx.insert(logisticsQuoteLineItems).values(
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

      return updated;
    });

    logger.info('Updated freight quote', { quoteId: id });

    return updatedQuote;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    logger.error('Failed to update freight quote', {
      error: error instanceof Error ? error.message : String(error),
      quoteId: id,
    });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update quote',
    });
  }
});

export default adminUpdateQuote;
