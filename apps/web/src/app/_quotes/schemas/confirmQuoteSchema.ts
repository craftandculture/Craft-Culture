import { z } from 'zod';

/**
 * Schema for C&C confirming a quote
 */
const confirmQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  deliveryLeadTime: z.string().min(1, 'Delivery lead time is required'),
  ccConfirmationNotes: z.string().optional(),
  lineItemAdjustments: z
    .record(
      z.string(),
      z.object({
        adjustedPricePerCase: z.number().optional(),
        confirmedQuantity: z.number().optional(),
        available: z.boolean(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
});

export default confirmQuoteSchema;
