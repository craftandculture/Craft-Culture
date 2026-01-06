import { z } from 'zod';

const createRfqSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  sourceType: z.enum(['excel', 'email_text', 'manual']),
  sourceFileName: z.string().optional(),
  rawInputText: z.string().optional(),
  distributorName: z.string().optional(),
  distributorEmail: z.string().email().optional().or(z.literal('')),
  distributorCompany: z.string().optional(),
  distributorNotes: z.string().optional(),
  responseDeadline: z.date().optional(),
});

export default createRfqSchema;
