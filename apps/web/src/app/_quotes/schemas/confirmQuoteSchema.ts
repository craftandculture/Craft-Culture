import { z } from 'zod';

/**
 * Schema for C&C confirming a quote
 */
const confirmQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  ccConfirmationNotes: z.string().optional(),
});

export default confirmQuoteSchema;
