import { z } from 'zod';

/**
 * Schema for customer accepting an alternative product suggestion
 */
const acceptAlternativeSchema = z.object({
  quoteId: z.string().uuid(),
  productId: z.string(),
  alternativeIndex: z.number().int().min(0),
});

export default acceptAlternativeSchema;
