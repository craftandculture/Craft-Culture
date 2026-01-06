import { z } from 'zod';

const selectQuoteSchema = z.object({
  itemId: z.string().uuid(),
  quoteId: z.string().uuid(),
  finalPriceUsd: z.number().positive().optional(),
});

export default selectQuoteSchema;
