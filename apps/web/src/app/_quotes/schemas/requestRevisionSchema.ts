import { z } from 'zod';

/**
 * Schema for alternative product/vintage suggestion
 */
const revisionAlternativeSchema = z.object({
  vintage: z.string().optional(),
  availability: z.string().optional(),
  priceAdjustment: z.string().optional(),
});

/**
 * Schema for line item revision suggestion
 */
const lineItemRevisionSchema = z.object({
  lineItemIndex: z.number().int().min(0),
  issue: z.string(),
  alternatives: z.array(revisionAlternativeSchema).optional(),
  suggestion: z.string().optional(),
});

/**
 * Schema for revision suggestions structure
 */
const revisionSuggestionsSchema = z.object({
  items: z.array(lineItemRevisionSchema),
  generalNotes: z.string().optional(),
});

/**
 * Schema for requesting revision on a quote
 */
const requestRevisionSchema = z.object({
  quoteId: z.string().uuid(),
  revisionReason: z.string().min(1, 'Revision reason is required'),
  revisionSuggestions: revisionSuggestionsSchema,
});

export default requestRevisionSchema;
