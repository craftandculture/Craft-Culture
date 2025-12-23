import z from 'zod';

const createPartnerSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['retailer', 'sommelier', 'distributor']),
  businessName: z.string().min(1, 'Business name is required'),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional().or(z.literal('')),
  taxId: z.string().optional(),
  commissionRate: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;

export default createPartnerSchema;
