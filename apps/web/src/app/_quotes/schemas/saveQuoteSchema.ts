import { z } from 'zod';

import quoteExtrasSchema from './quoteExtrasSchema';

/**
 * Schema for saving a new quote
 *
 * @example
 *   {
 *     name: "Hotel ABC Order - January 2025",
 *     lineItems: [...],
 *     quoteData: {...},
 *     clientName: "John Doe",
 *     clientEmail: "john@example.com",
 *     clientCompany: "ABC Hotel Group",
 *     notes: "Rush order",
 *     currency: "AED",
 *     totalUsd: 5000.00,
 *     totalAed: 18350.00
 *   }
 */
const saveQuoteSchema = z.object({
  name: z.string().min(1).max(255),
  lineItems: z
    .array(
      z.object({
        productId: z.string().uuid(),
        offerId: z.string().uuid(),
        quantity: z.number().int().min(1),
        vintage: z.string().optional(),
        alternativeVintages: z.array(z.string()).optional(),
      }),
    )
    .max(200),
  /** Customer-chosen extras only; prices are recomputed on the server */
  quoteData: quoteExtrasSchema,
  clientName: z.string().min(1).max(255).optional(),
  clientEmail: z.string().email().max(255).optional(),
  clientCompany: z.string().min(1).max(255).optional(),
  notes: z.string().max(5000).optional(),
  currency: z.enum(['USD', 'AED']).default('USD'),
  /** Ignored: the server prices the quote itself */
  totalUsd: z.number().optional(),
  /** Ignored: the server prices the quote itself */
  totalAed: z.number().optional(),
  expiresAt: z.date().optional(),
});

export type SaveQuoteSchema = z.infer<typeof saveQuoteSchema>;

export default saveQuoteSchema;
