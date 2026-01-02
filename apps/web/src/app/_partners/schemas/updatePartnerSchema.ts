import z from 'zod';

const paymentDetailsSchema = z.object({
  // Bank transfer details
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  sortCode: z.string().optional(),
  iban: z.string().optional(),
  swiftBic: z.string().optional(),
  reference: z.string().optional(),
  // Payment link
  paymentUrl: z.string().url().optional().or(z.literal('')),
});

const updatePartnerSchema = z.object({
  partnerId: z.string().uuid(),
  type: z.enum(['retailer', 'sommelier', 'distributor']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  businessName: z.string().min(1).optional(),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional().or(z.literal('')),
  taxId: z.string().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  // Branding
  logoUrl: z.string().url().optional().or(z.literal('')),
  // Payment configuration (partner can have both bank transfer AND payment link)
  paymentDetails: paymentDetailsSchema.optional(),
  // PCO pricing settings
  logisticsCostPerCase: z.number().min(0).optional(),
  pcoDutyRate: z.number().min(0).max(1).optional(),
  pcoVatRate: z.number().min(0).max(1).optional(),
});

export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;

export default updatePartnerSchema;
