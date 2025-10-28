import { z } from 'zod';

/**
 * Schema for updating an existing quote
 *
 * @example
 *   {
 *     id: "uuid-here",
 *     name: "Updated Hotel ABC Order",
 *     ...
 *   }
 */
const updateQuoteSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  lineItems: z
    .array(
      z.object({
        productId: z.string().uuid(),
        offerId: z.string().uuid(),
        quantity: z.number().int().min(1),
        vintage: z.string().optional(),
      }),
    )
    .optional(),
  quoteData: z.any().optional(),
  clientName: z.string().min(1).max(255).optional(),
  clientEmail: z.string().email().max(255).optional(),
  clientCompany: z.string().min(1).max(255).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
  currency: z.enum(['USD', 'AED']).optional(),
  totalUsd: z.number().optional(),
  totalAed: z.number().optional(),
  expiresAt: z.date().optional().nullable(),
});

export type UpdateQuoteSchema = z.infer<typeof updateQuoteSchema>;

export default updateQuoteSchema;
