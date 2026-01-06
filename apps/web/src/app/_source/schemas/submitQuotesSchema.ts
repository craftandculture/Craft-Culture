import { z } from 'zod';

import { sourceRfqQuoteType } from '@/database/schema';

const quoteItemSchema = z.object({
  itemId: z.string().uuid(),
  quoteType: z.enum(sourceRfqQuoteType.enumValues),
  costPricePerCaseUsd: z.number().positive(),
  currency: z.string().default('USD'),
  availableQuantity: z.number().int().positive().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  stockLocation: z.string().optional(),
  moq: z.number().int().positive().optional(),
  validUntil: z.date().optional(),
  notes: z.string().optional(),
  // For alternatives
  alternativeProductName: z.string().optional(),
  alternativeProducer: z.string().optional(),
  alternativeVintage: z.string().optional(),
  alternativeRegion: z.string().optional(),
  alternativeBottleSize: z.string().optional(),
  alternativeCaseConfig: z.number().int().positive().optional(),
  alternativeLwin: z.string().optional(),
  alternativeReason: z.string().optional(),
});

const submitQuotesSchema = z.object({
  rfqId: z.string().uuid(),
  quotes: z.array(quoteItemSchema).min(1, 'At least one quote is required'),
  partnerNotes: z.string().optional(),
});

export default submitQuotesSchema;
