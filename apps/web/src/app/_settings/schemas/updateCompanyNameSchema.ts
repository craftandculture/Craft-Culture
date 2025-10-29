import { z } from 'zod';

/**
 * Schema for updating company information
 */
const updateCompanyNameSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(100, 'Company name must be less than 100 characters'),
  companyAddress: z.string().max(500).optional(),
  companyPhone: z.string().max(50).optional(),
  companyEmail: z.string().email('Please enter a valid email').max(255).optional().or(z.literal('')),
  companyWebsite: z.string().url('Please enter a valid URL').max(255).optional().or(z.literal('')),
  companyVatNumber: z.string().max(100).optional(),
});

export default updateCompanyNameSchema;
