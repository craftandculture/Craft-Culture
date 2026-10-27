import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  sourceRfqItems,
  sourceRfqPartners,
  sourceRfqQuotes,
  sourceRfqs,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import submitQuotesSchema from '../schemas/submitQuotesSchema';
import notifyAdminOfPartnerResponse from '../utils/notifyAdminOfPartnerResponse';

/**
 * Submit quotes for SOURCE RFQ items
 *
 * @example
 *   await trpcClient.source.partner.submitQuotes.mutate({
 *     rfqId: "uuid-here",
 *     quotes: [
 *       { itemId: "item-1", quoteType: "exact", costPricePerCaseUsd: 100 },
 *       { itemId: "item-2", quoteType: "alternative", costPricePerCaseUsd: 85, alternativeProductName: "..." }
 *     ],
 *     partnerNotes: "Delivery in 2 weeks"
 *   });
 */
const partnerSubmitQuotes = winePartnerProcedure
  .input(submitQuotesSchema)
  .mutation(async ({ input, ctx: { partnerId } }) => {
    const { rfqId, quotes, partnerNotes } = input;

    // Verify RFQ is assigned to this partner
    const [assignment] = await db
      .select({
        assignment: sourceRfqPartners,
        rfqStatus: sourceRfqs.status,
        responseDeadline: sourceRfqs.responseDeadline,
      })
      .from(sourceRfqPartners)
      .innerJoin(sourceRfqs, eq(sourceRfqPartners.rfqId, sourceRfqs.id))
      .where(
        and(
          eq(sourceRfqPartners.rfqId, rfqId),
          eq(sourceRfqPartners.partnerId, partnerId),
        ),
      );

    if (!assignment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found or not assigned to your organization',
      });
    }

    // Check RFQ is still open for quotes
    // Allow quotes during sent, collecting, comparing, and selecting phases
    // Only block once RFQ moves to client_review or beyond
    const quotableStatuses = ['sent', 'collecting', 'comparing', 'selecting'];
    if (!quotableStatuses.includes(assignment.rfqStatus)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'RFQ is no longer accepting quotes',
      });
    }

    // Check if deadline has passed
    if (assignment.responseDeadline && new Date() > assignment.responseDeadline) {
      // Update partner status to expired
      await db
        .update(sourceRfqPartners)
        .set({ status: 'expired' })
        .where(eq(sourceRfqPartners.id, assignment.assignment.id));

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'The deadline for this RFQ has passed. Quotes can no longer be submitted.',
      });
    }

    // Allow updating quotes if already submitted (before deadline)
    // Note: We no longer block re-submission - partners can update their quotes

    // Verify all item IDs belong to this RFQ
    // Note: Multiple quotes per item are allowed (e.g., different vintages)
    const uniqueItemIds = [...new Set(quotes.map((q) => q.itemId))];
    const validItems = await db
      .select({ id: sourceRfqItems.id })
      .from(sourceRfqItems)
      .where(
        and(
          eq(sourceRfqItems.rfqId, rfqId),
          inArray(sourceRfqItems.id, uniqueItemIds),
        ),
      );

    if (validItems.length !== uniqueItemIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'One or more item IDs are invalid',
      });
    }

    // Prepare quote values
    const quoteValues = quotes.map((quote) => ({
      rfqId,
      itemId: quote.itemId,
      rfqPartnerId: assignment.assignment.id,
      partnerId,
      quoteType: quote.quoteType,
      // Which specific vintage the partner is quoting on
      quotedVintage: quote.quotedVintage,
      // N/A quotes don't have a price
      costPricePerCaseUsd:
        quote.quoteType === 'not_available' ? null : quote.costPricePerCaseUsd,
      currency: quote.currency || 'USD',
      caseConfig: quote.caseConfig,
      bottleSize: quote.bottleSize,
      availableQuantity: quote.availableQuantity,
      leadTimeDays: quote.leadTimeDays,
      stockLocation: quote.stockLocation,
      stockCondition: quote.stockCondition,
      moq: quote.moq,
      validUntil: quote.validUntil,
      notes: quote.notes,
      notAvailableReason: quote.notAvailableReason,
      alternativeProductName: quote.alternativeProductName,
      alternativeProducer: quote.alternativeProducer,
      alternativeVintage: quote.alternativeVintage,
      alternativeRegion: quote.alternativeRegion,
      alternativeCountry: quote.alternativeCountry,
      alternativeBottleSize: quote.alternativeBottleSize,
      alternativeCaseConfig: quote.alternativeCaseConfig,
      alternativeLwin: quote.alternativeLwin,
      alternativeReason: quote.alternativeReason,
    }));

    // Use transaction to ensure atomicity of all database operations
    await db.transaction(async (tx) => {
      // Lock this partner's quotes, then refuse once C&C has selected any of
      // them: a resubmission would delete the selected quote (wiping the
      // selection) or reprice a line after it was picked.
      const existingQuotes = await tx
        .select({ id: sourceRfqQuotes.id, isSelected: sourceRfqQuotes.isSelected })
        .from(sourceRfqQuotes)
        .where(
          and(
            eq(sourceRfqQuotes.rfqId, rfqId),
            eq(sourceRfqQuotes.partnerId, partnerId),
          ),
        )
        .for('update');

      if (existingQuotes.some((q) => q.isSelected)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Craft & Culture has already selected one of your quotes on this RFQ, so it can no longer be changed. Please contact the team if your price or availability has changed.',
        });
      }

      // Delete any existing quotes from this partner for this RFQ
      await tx
        .delete(sourceRfqQuotes)
        .where(
          and(
            eq(sourceRfqQuotes.rfqId, rfqId),
            eq(sourceRfqQuotes.partnerId, partnerId),
          ),
        );

      // Insert new quotes
      await tx.insert(sourceRfqQuotes).values(quoteValues);

      // Update partner assignment
      const isFirstSubmission = assignment.assignment.status !== 'submitted';
      await tx
        .update(sourceRfqPartners)
        .set({
          status: 'submitted',
          submittedAt: new Date(),
          partnerNotes,
          quoteCount: quotes.length,
        })
        .where(eq(sourceRfqPartners.id, assignment.assignment.id));

      // Update RFQ response count only on first submission
      if (isFirstSubmission) {
        await tx
          .update(sourceRfqs)
          .set({
            responseCount: sql`${sourceRfqs.responseCount} + 1`,
          })
          .where(eq(sourceRfqs.id, rfqId));

        // Only move forward from 'sent'; never pull a later stage back
        await tx
          .update(sourceRfqs)
          .set({ status: 'collecting' })
          .where(and(eq(sourceRfqs.id, rfqId), eq(sourceRfqs.status, 'sent')));
      }

      // Update item statuses to quoted (never downgrade a selected item)
      await tx
        .update(sourceRfqItems)
        .set({ status: 'quoted' })
        .where(
          and(
            eq(sourceRfqItems.rfqId, rfqId),
            inArray(sourceRfqItems.id, uniqueItemIds),
            inArray(sourceRfqItems.status, ['pending', 'no_response']),
          ),
        );
    });

    // Notify admins of the response (non-blocking, outside transaction)
    void notifyAdminOfPartnerResponse({
      rfqId,
      partnerId,
      quoteCount: quotes.length,
    });

    // Track whether this was first submission for the return value
    const wasFirstSubmission = assignment.assignment.status !== 'submitted';

    return {
      success: true,
      quoteCount: quotes.length,
      isUpdate: !wasFirstSubmission,
    };
  });

export default partnerSubmitQuotes;
