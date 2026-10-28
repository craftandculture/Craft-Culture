import { z } from 'zod';

import quoteExtrasSchema from './quoteExtrasSchema';

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
        alternativeVintages: z.array(z.string()).optional(),
      }),
    )
    .max(200)
    .optional(),
  /** Customer-chosen extras only; prices are recomputed on the server */
  quoteData: quoteExtrasSchema,
  clientName: z.string().min(1).max(255).optional(),
  clientEmail: z.string().email().max(255).optional(),
  clientCompany: z.string().min(1).max(255).optional(),
  notes: z.string().max(5000).optional(),
  // No `status` here: a quote moves through its workflow only via the
  // dedicated endpoints (submit buy request, PO, payment proof, admin
  // approval), never by the owner setting it directly — that let a user mark
  // their own quote accepted.
  currency: z.enum(['USD', 'AED']).optional(),
  /** Ignored: the server prices the quote itself */
  totalUsd: z.number().optional(),
  /** Ignored: the server prices the quote itself */
  totalAed: z.number().optional(),
  expiresAt: z.date().optional().nullable(),
});

export type UpdateQuoteSchema = z.infer<typeof updateQuoteSchema>;

export default updateQuoteSchema;
