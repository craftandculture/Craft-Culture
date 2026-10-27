import z from 'zod';

import isHttpsUrl from '@/utils/isHttpsUrl';

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
  paymentUrl: z.string().url().refine(isHttpsUrl, 'Must be an https:// link').optional().or(z.literal('')),
});

const updatePartnerSchema = z.object({
  partnerId: z.string().uuid(),
  /*
    Includes the stock-owning types so a partner filed under the wrong one can
    be corrected in the admin. Reclassifying changes what the partner can reach;
    it does not touch their stock, which is keyed on owner id throughout.
  */
  type: z
    .enum([
      'retailer',
      'sommelier',
      'distributor',
      'wine_partner',
      'private_collector',
    ])
    .optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  businessName: z.string().min(1).optional(),
  businessAddress: z.string().optional(),
  deliveryAddress: z.string().optional(),
  deliveryInstructions: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional().or(z.literal('')),
  taxId: z.string().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  // Branding
  logoUrl: z.string().url().refine(isHttpsUrl, 'Must be an https:// link').optional().or(z.literal('')),
  // Payment configuration (partner can have both bank transfer AND payment link)
  /** null clears every payment method */
  paymentDetails: paymentDetailsSchema.nullable().optional(),
  // PCO pricing settings
  /** null clears the partner's own figure, so the global default applies */
  logisticsCostPerCase: z.number().min(0).nullable().optional(),
  pcoDutyRate: z.number().min(0).max(1).nullable().optional(),
  pcoVatRate: z.number().min(0).max(1).nullable().optional(),
  // Finance email for proforma invoices (distributors only)
  financeEmail: z.string().email().optional().or(z.literal('')),
});

export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;

export default updatePartnerSchema;
