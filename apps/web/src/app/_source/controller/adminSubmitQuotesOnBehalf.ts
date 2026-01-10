import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  sourceRfqItems,
  sourceRfqPartners,
  sourceRfqQuotes,
  sourceRfqs,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import submitQuotesSchema from '../schemas/submitQuotesSchema';

// Extend the base schema to require partnerId
const adminSubmitQuotesSchema = submitQuotesSchema.extend({
  partnerId: z.string().uuid(),
});

/**
 * Submit quotes on behalf of a partner
 *
 * Admin can submit quotes for a partner when the partner provides
 * their response via email or other channels outside the platform.
 *
 * @example
 *   await trpcClient.source.admin.submitQuotesOnBehalf.mutate({
 *     rfqId: "uuid",
 *     partnerId: "uuid",
 *     quotes: [
 *       { itemId: "item-1", quoteType: "exact", costPricePerCaseUsd: 100 },
 *       { itemId: "item-2", quoteType: "not_available" }
 *     ],
 *     partnerNotes: "Response received via email"
 *   });
 */
const adminSubmitQuotesOnBehalf = adminProcedure
  .input(adminSubmitQuotesSchema)
  .mutation(async ({ input }) => {
    const { rfqId, partnerId, quotes, partnerNotes } = input;

    // Verify RFQ exists
    const [rfq] = await db
      .select()
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!rfq) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    // Verify partner exists and is a wine partner
    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, partnerId));

    if (!partner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Partner not found',
      });
    }

    if (partner.type !== 'wine_partner') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Partner is not a wine partner',
      });
    }

    // Verify partner is assigned to this RFQ
    const [assignment] = await db
      .select()
      .from(sourceRfqPartners)
      .where(
        and(
          eq(sourceRfqPartners.rfqId, rfqId),
          eq(sourceRfqPartners.partnerId, partnerId)
        )
      );

    if (!assignment) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Partner is not assigned to this RFQ',
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
          inArray(sourceRfqItems.id, itemIds)
        )
      );

    if (validItems.length !== itemIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'One or more item IDs are invalid',
      });
    }

    // Prepare quote values
    const quoteValues = quotes.map((quote) => ({
      rfqId,
      itemId: quote.itemId,
      rfqPartnerId: assignment.id,
      partnerId,
      quoteType: quote.quoteType,
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

    // Check if partner already submitted (we'll overwrite if so, since admin is doing it)
    const hadPreviousSubmission = assignment.status === 'submitted';

    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Delete any existing quotes from this partner for this RFQ
      await tx
        .delete(sourceRfqQuotes)
        .where(
          and(
            eq(sourceRfqQuotes.rfqId, rfqId),
            eq(sourceRfqQuotes.partnerId, partnerId)
          )
        );

      // Insert new quotes
      await tx.insert(sourceRfqQuotes).values(quoteValues);

      // Update partner assignment with admin submission note
      const adminNote = partnerNotes
        ? `[Submitted by admin] ${partnerNotes}`
        : '[Submitted by admin on behalf of partner]';

      await tx
        .update(sourceRfqPartners)
        .set({
          status: 'submitted',
          submittedAt: new Date(),
          partnerNotes: adminNote,
          quoteCount: quotes.length,
        })
        .where(eq(sourceRfqPartners.id, assignment.id));

      // Only increment response count if this is a new submission
      if (!hadPreviousSubmission) {
        await tx
          .update(sourceRfqs)
          .set({
            responseCount: sql`${sourceRfqs.responseCount} + 1`,
            status: 'collecting',
          })
          .where(eq(sourceRfqs.id, rfqId));
      }

      // Update item statuses to quoted
      await tx
        .update(sourceRfqItems)
        .set({ status: 'quoted' })
        .where(
          and(
            eq(sourceRfqItems.rfqId, rfqId),
            inArray(sourceRfqItems.id, itemIds)
          )
        );
    });

    return {
      success: true,
      quoteCount: quotes.length,
      partnerName: partner.businessName,
      message: `Submitted ${quotes.length} quotes on behalf of ${partner.businessName}`,
    };
  });

export default adminSubmitQuotesOnBehalf;
