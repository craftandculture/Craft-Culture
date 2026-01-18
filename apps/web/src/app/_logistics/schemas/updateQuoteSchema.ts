import { z } from 'zod';

/**
 * Schema for updating an existing freight quote
 */
const updateQuoteSchema = z.object({
  id: z.string().uuid(),

  // Forwarder info
  forwarderName: z.string().min(1).optional(),
  forwarderContact: z.string().optional(),
  forwarderEmail: z.string().email('Invalid email').optional().or(z.literal('')),

  // Route details
  originCountry: z.string().optional(),
  originCity: z.string().optional(),
  destinationCountry: z.string().optional(),
  destinationCity: z.string().optional(),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']).optional(),

  // Pricing
  totalPrice: z.number().positive('Price must be positive').optional(),
  currency: z.string().optional(),

  // Transit details
  transitDays: z.number().int().positive().optional(),

  // Validity
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),

  // Notes
  notes: z.string().optional(),
  internalNotes: z.string().optional(),

  // Line items (replaces all existing if provided)
  lineItems: z
    .array(
      z.object({
        category: z.string().min(1),
        description: z.string().min(1),
        unitPrice: z.number().optional(),
        quantity: z.number().int().default(1),
        total: z.number(),
        currency: z.string().optional(),
      }),
    )
    .optional(),
});

export default updateQuoteSchema;
