import { z } from 'zod';

/**
 * Schema for updating company name
 */
const updateCompanyNameSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(100, 'Company name must be less than 100 characters'),
});

export default updateCompanyNameSchema;
