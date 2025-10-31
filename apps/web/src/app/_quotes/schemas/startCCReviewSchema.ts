import { z } from 'zod';

/**
 * Schema for starting C&C review on a quote
 */
const startCCReviewSchema = z.object({
  quoteId: z.string().uuid(),
  ccNotes: z.string().optional(),
});

export default startCCReviewSchema;
