import { z } from 'zod';

/**
 * Schema for submitting a buy request on a quote
 */
const submitBuyRequestSchema = z.object({
  quoteId: z.string().uuid(),
});

export default submitBuyRequestSchema;
