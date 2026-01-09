import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';

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
    const quotableStatuses = ['sent', 'collecting'];
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

    // Check partner hasn't already submitted
    if (assignment.assignment.status === 'submitted') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Quotes have already been submitted for this RFQ',
      });
    }

    // Verify all item IDs belong to this RFQ
    const itemIds = quotes.map((q) => q.itemId);
    const validItems = await db
      .select({ id: sourceRfqItems.id })
      .from(sourceRfqItems)
      .where(
        and(
          eq(sourceRfqItems.rfqId, rfqId),
          sql`${sourceRfqItems.id} IN ${itemIds}`,
        ),
      );

    if (validItems.length !== itemIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'One or more item IDs are invalid',
      });
    }

    // Delete any existing quotes from this partner for this RFQ
    await db
      .delete(sourceRfqQuotes)
      .where(
        and(
          eq(sourceRfqQuotes.rfqId, rfqId),
          eq(sourceRfqQuotes.partnerId, partnerId),
        ),
      );

    // Insert new quotes
    const quoteValues = quotes.map((quote) => ({
      rfqId,
      itemId: quote.itemId,
      rfqPartnerId: assignment.assignment.id,
      partnerId,
      quoteType: quote.quoteType,
      // N/A quotes don't have a price
      costPricePerCaseUsd:
        quote.quoteType === 'not_available' ? null : quote.costPricePerCaseUsd,
      currency: quote.currency || 'USD',
      caseConfig: quote.caseConfig,
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

    await db.insert(sourceRfqQuotes).values(quoteValues);

    // Update partner assignment
    await db
      .update(sourceRfqPartners)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        partnerNotes,
        quoteCount: quotes.length,
      })
      .where(eq(sourceRfqPartners.id, assignment.assignment.id));

    // Update RFQ response count and status
    await db
      .update(sourceRfqs)
      .set({
        responseCount: sql`${sourceRfqs.responseCount} + 1`,
        status: 'collecting',
      })
      .where(eq(sourceRfqs.id, rfqId));

    // Update item statuses to quoted
    await db
      .update(sourceRfqItems)
      .set({ status: 'quoted' })
      .where(
        and(
          eq(sourceRfqItems.rfqId, rfqId),
          sql`${sourceRfqItems.id} IN ${itemIds}`,
        ),
      );

    // Notify admins of the response (non-blocking)
    void notifyAdminOfPartnerResponse({
      rfqId,
      partnerId,
      quoteCount: quotes.length,
    });

    return {
      success: true,
      quoteCount: quotes.length,
    };
  });

export default partnerSubmitQuotes;
