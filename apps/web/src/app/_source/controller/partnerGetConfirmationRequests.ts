import { and, desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  sourceRfqItems,
  sourceRfqQuotes,
  sourceRfqs,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Get pending confirmation requests for the partner
 *
 * Returns all RFQs where the partner has selected quotes awaiting confirmation.
 *
 * @example
 *   const requests = await trpcClient.source.partner.getConfirmationRequests.query();
 */
const partnerGetConfirmationRequests = winePartnerProcedure.query(
  async ({ ctx }) => {
    const partnerId = ctx.partnerId;

    // Get all selected quotes with pending confirmation for this partner
    const pendingQuotes = await db
      .select({
        quoteId: sourceRfqQuotes.id,
        rfqId: sourceRfqQuotes.rfqId,
        rfqNumber: sourceRfqs.rfqNumber,
        rfqName: sourceRfqs.name,
        rfqStatus: sourceRfqs.status,
        itemId: sourceRfqQuotes.itemId,
        productName: sourceRfqItems.productName,
        producer: sourceRfqItems.producer,
        vintage: sourceRfqItems.vintage,
        quantity: sourceRfqItems.quantity,
        quantityUnit: sourceRfqItems.quantityUnit,
        quoteType: sourceRfqQuotes.quoteType,
        quotedVintage: sourceRfqQuotes.quotedVintage,
        costPricePerCaseUsd: sourceRfqQuotes.costPricePerCaseUsd,
        availableQuantity: sourceRfqQuotes.availableQuantity,
        leadTimeDays: sourceRfqQuotes.leadTimeDays,
        bottleSize: sourceRfqQuotes.bottleSize,
        caseConfig: sourceRfqQuotes.caseConfig,
        stockLocation: sourceRfqQuotes.stockLocation,
        notes: sourceRfqQuotes.notes,
        // Alternative product details
        alternativeProductName: sourceRfqQuotes.alternativeProductName,
        alternativeProducer: sourceRfqQuotes.alternativeProducer,
        alternativeVintage: sourceRfqQuotes.alternativeVintage,
        alternativeReason: sourceRfqQuotes.alternativeReason,
        confirmationStatus: sourceRfqQuotes.confirmationStatus,
        confirmationRequestedAt: sourceRfqQuotes.confirmationRequestedAt,
        createdAt: sourceRfqQuotes.createdAt,
      })
      .from(sourceRfqQuotes)
      .innerJoin(sourceRfqs, eq(sourceRfqQuotes.rfqId, sourceRfqs.id))
      .innerJoin(sourceRfqItems, eq(sourceRfqQuotes.itemId, sourceRfqItems.id))
      .where(
        and(
          eq(sourceRfqQuotes.partnerId, partnerId),
          eq(sourceRfqQuotes.isSelected, true),
          eq(sourceRfqQuotes.confirmationStatus, 'pending'),
          eq(sourceRfqs.status, 'awaiting_confirmation'),
        ),
      )
      .orderBy(desc(sourceRfqQuotes.confirmationRequestedAt));

    // Group by RFQ
    const rfqMap = new Map<
      string,
      {
        rfqId: string;
        rfqNumber: string;
        rfqName: string;
        confirmationRequestedAt: Date | null;
        quotes: typeof pendingQuotes;
      }
    >();

    for (const quote of pendingQuotes) {
      if (!rfqMap.has(quote.rfqId)) {
        rfqMap.set(quote.rfqId, {
          rfqId: quote.rfqId,
          rfqNumber: quote.rfqNumber,
          rfqName: quote.rfqName,
          confirmationRequestedAt: quote.confirmationRequestedAt,
          quotes: [],
        });
      }
      rfqMap.get(quote.rfqId)!.quotes.push(quote);
    }

    return {
      pendingCount: pendingQuotes.length,
      rfqs: Array.from(rfqMap.values()),
    };
  },
);

export default partnerGetConfirmationRequests;
