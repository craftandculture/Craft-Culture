import { z } from 'zod';

/**
 * Schema for customer accepting or removing an alternative product suggestion
 * alternativeIndex: -1 to remove accepted alternative, >= 0 to accept specific alternative
 */
const acceptAlternativeSchema = z.object({
  quoteId: z.string().uuid(),
  productId: z.string(),
  alternativeIndex: z.number().int().min(-1),
});

export default acceptAlternativeSchema;
