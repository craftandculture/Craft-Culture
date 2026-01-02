import z from 'zod';

/**
 * Schema for creating a licensed partner entity
 *
 * Partners are external business entities (retailers, distributors) that
 * fulfill B2C orders. They are NOT platform users - they're licensed
 * mainland entities that receive payment from customers and purchase
 * inventory from C&C.
 */
const createPartnerSchema = z.object({
  // Core business details
  type: z.enum(['retailer', 'sommelier', 'distributor', 'wine_partner']),
  businessName: z.string().min(1, 'Business name is required'),
  businessAddress: z.string().min(1, 'Business address is required'),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional().or(z.literal('')),
  taxId: z.string().min(1, 'TRN/Tax ID is required'),
  // Branding
  logoUrl: z.string().url().optional().or(z.literal('')),
  // Payment configuration (partner can have both bank transfer AND payment link)
  paymentDetails: z
    .object({
      bankName: z.string().optional(),
      accountName: z.string().optional(),
      accountNumber: z.string().optional(),
      sortCode: z.string().optional(),
      iban: z.string().optional(),
      swiftBic: z.string().optional(),
      reference: z.string().optional(),
      paymentUrl: z.string().url().optional(),
    })
    .optional(),
  // Other
  commissionRate: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;

export default createPartnerSchema;
