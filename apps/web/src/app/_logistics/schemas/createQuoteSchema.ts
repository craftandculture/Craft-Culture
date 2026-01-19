import { z } from 'zod';

/**
 * Schema for creating a new freight quote
 */
const createQuoteSchema = z.object({
  // Forwarder info
  forwarderName: z.string().min(1, 'Forwarder name is required'),
  forwarderContact: z.string().optional(),
  forwarderEmail: z.string().email('Invalid email').optional().or(z.literal('')),

  // Optional link to shipment
  shipmentId: z.string().uuid().optional(),

  // Optional link to quote request
  requestId: z.string().uuid().optional(),

  // Route details
  originCountry: z.string().optional(),
  originCity: z.string().optional(),
  destinationCountry: z.string().optional(),
  destinationCity: z.string().optional(),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']).optional(),

  // Pricing
  totalPrice: z.number().positive('Price must be positive'),
  currency: z.string().default('USD'),

  // Transit details
  transitDays: z.number().int().positive().optional(),

  // Validity
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),

  // Notes
  notes: z.string().optional(),
  internalNotes: z.string().optional(),

  // Line items (optional detailed breakdown)
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

export default createQuoteSchema;
