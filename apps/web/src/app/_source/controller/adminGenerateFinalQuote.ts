import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  partners,
  sourceRfqItems,
  sourceRfqQuotes,
  sourceRfqs,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import generateFinalQuoteSchema from '../schemas/generateFinalQuoteSchema';

/**
 * Generate final quote data from selected quotes
 * Returns data for PDF/Excel export
 *
 * @example
 *   await trpcClient.source.admin.generateFinalQuote.mutate({
 *     rfqId: "uuid-here"
 *   });
 */
const adminGenerateFinalQuote = adminProcedure
  .input(generateFinalQuoteSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { rfqId } = input;

    // Get RFQ
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

    // Get all items with selected quotes
    const items = await db
      .select({
        item: sourceRfqItems,
        selectedQuote: sourceRfqQuotes,
        partner: {
          id: partners.id,
          businessName: partners.businessName,
        },
      })
      .from(sourceRfqItems)
      .leftJoin(
        sourceRfqQuotes,
        eq(sourceRfqItems.selectedQuoteId, sourceRfqQuotes.id),
      )
      .leftJoin(partners, eq(sourceRfqQuotes.partnerId, partners.id))
      .where(eq(sourceRfqItems.rfqId, rfqId));

    // Check if any items are missing quotes or have N/A quotes (no price)
    const itemsWithoutQuotes = items.filter(
      (i) => !i.selectedQuote || i.selectedQuote.costPricePerCaseUsd === null,
    );
    const itemsWithQuotes = items.filter(
      (i) => i.selectedQuote && i.selectedQuote.costPricePerCaseUsd !== null,
    );

    // Calculate totals
    let totalCostUsd = 0;
    let totalFinalUsd = 0;

    const lineItems = itemsWithQuotes.map((row) => {
      const item = row.item;
      const quote = row.selectedQuote!;
      const quantity = item.quantity || 1;

      // costPricePerCaseUsd is guaranteed non-null by the filter above
      const costPerCase = quote.costPricePerCaseUsd ?? 0;
      const finalPerCase = item.finalPriceUsd || costPerCase;
      const lineTotal = finalPerCase * quantity;

      totalCostUsd += costPerCase * quantity;
      totalFinalUsd += lineTotal;

      return {
        productName: quote.quoteType === 'alternative'
          ? quote.alternativeProductName || item.productName
          : item.productName,
        producer: quote.quoteType === 'alternative'
          ? quote.alternativeProducer || item.producer
          : item.producer,
        // Use quotedVintage from the quote (the specific vintage being supplied)
        // Falls back to item.vintage for alternatives or if quotedVintage not set
        vintage: quote.quoteType === 'alternative'
          ? quote.alternativeVintage || item.vintage
          : quote.quotedVintage || item.vintage,
        region: quote.quoteType === 'alternative'
          ? quote.alternativeRegion || item.region
          : item.region,
        bottleSize: quote.quoteType === 'alternative'
          ? quote.alternativeBottleSize || item.bottleSize
          : item.bottleSize,
        // Use caseConfig from the quote (e.g., "3x75cl", "6x75cl")
        // Falls back to item.caseConfig if quote doesn't have it
        caseConfig: quote.quoteType === 'alternative'
          ? quote.alternativeCaseConfig || item.caseConfig
          : quote.caseConfig || item.caseConfig,
        // Include LWIN for PDF/Excel export
        lwin: item.lwin,
        quantity,
        pricePerCase: finalPerCase,
        lineTotal,
        isAlternative: quote.quoteType === 'alternative',
        alternativeReason: quote.alternativeReason,
        leadTimeDays: quote.leadTimeDays,
        stockLocation: quote.stockLocation,
        supplierName: row.partner?.businessName,
      };
    });

    // Update RFQ status to quote_generated
    await db
      .update(sourceRfqs)
      .set({ status: 'quote_generated' })
      .where(eq(sourceRfqs.id, rfqId));

    return {
      rfq: {
        rfqNumber: rfq.rfqNumber,
        name: rfq.name,
        distributorName: rfq.distributorName,
        distributorEmail: rfq.distributorEmail,
        distributorCompany: rfq.distributorCompany,
        distributorNotes: rfq.distributorNotes,
        generatedAt: new Date(),
        generatedBy: user.id,
      },
      lineItems,
      summary: {
        totalItems: items.length,
        quotedItems: itemsWithQuotes.length,
        unquotedItems: itemsWithoutQuotes.length,
        totalCostUsd,
        totalFinalUsd,
        margin: totalFinalUsd > 0 ? ((totalFinalUsd - totalCostUsd) / totalFinalUsd) * 100 : 0,
      },
      unquotedItems: itemsWithoutQuotes.map((row) => ({
        productName: row.item.productName,
        producer: row.item.producer,
        vintage: row.item.vintage,
        quantity: row.item.quantity,
      })),
    };
  });

export default adminGenerateFinalQuote;
