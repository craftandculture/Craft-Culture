import { z } from 'zod';

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
  lineItems: z.array(
    z.object({
      productId: z.string().uuid(),
      offerId: z.string().uuid(),
      quantity: z.number().int().min(1),
      vintage: z.string().optional(),
      alternativeVintages: z.array(z.string()).optional(),
    }),
  ),
  quoteData: z.any(),
  clientName: z.string().min(1).max(255).optional(),
  clientEmail: z.string().email().max(255).optional(),
  clientCompany: z.string().min(1).max(255).optional(),
  notes: z.string().max(5000).optional(),
  currency: z.enum(['USD', 'AED']).default('USD'),
  totalUsd: z.number(),
  totalAed: z.number().optional(),
  expiresAt: z.date().optional(),
});

export type SaveQuoteSchema = z.infer<typeof saveQuoteSchema>;

export default saveQuoteSchema;
