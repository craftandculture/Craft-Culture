import { z } from 'zod';

import { sourceRfqQuoteType } from '@/database/schema';

const quoteItemSchema = z
  .object({
    itemId: z.string().uuid(),
    quoteType: z.enum(sourceRfqQuoteType.enumValues),
    // Quoted vintage - which specific vintage the partner is quoting on
    // (needed when RFQ item has multiple vintages like "2018, 2016, 2013")
    quotedVintage: z.string().optional(),
    // Price is optional for N/A quotes
    costPricePerCaseUsd: z.number().nonnegative().optional(),
    currency: z.string().default('USD'),
    // Case configuration (e.g., "6", "12", "6x75cl")
    caseConfig: z.string().optional(),
    // Availability
    availableQuantity: z.number().int().positive().optional(),
    leadTimeDays: z.number().int().nonnegative().optional(),
    stockLocation: z.string().optional(),
    stockCondition: z.string().optional(),
    moq: z.number().int().positive().optional(),
    // Validity
    validUntil: z.date().optional(),
    // Notes
    notes: z.string().optional(),
    // For N/A quotes
    notAvailableReason: z.string().optional(),
    // For alternatives
    alternativeProductName: z.string().optional(),
    alternativeProducer: z.string().optional(),
    alternativeVintage: z.string().optional(),
    alternativeRegion: z.string().optional(),
    alternativeCountry: z.string().optional(),
    alternativeBottleSize: z.string().optional(),
    alternativeCaseConfig: z.number().int().positive().optional(),
    alternativeLwin: z.string().optional(),
    alternativeReason: z.string().optional(),
  })
  .refine(
    (data) => {
      // N/A quotes don't need a price
      if (data.quoteType === 'not_available') {
        return true;
      }
      // Exact and alternative quotes need a positive price
      return data.costPricePerCaseUsd !== undefined && data.costPricePerCaseUsd > 0;
    },
    {
      message: 'Price is required for exact and alternative quotes',
      path: ['costPricePerCaseUsd'],
    },
  );

const submitQuotesSchema = z.object({
  rfqId: z.string().uuid(),
  quotes: z.array(quoteItemSchema).min(1, 'At least one quote is required'),
  partnerNotes: z.string().optional(),
});

export default submitQuotesSchema;
