import z from 'zod';

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
});

export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;

export default updatePartnerSchema;
