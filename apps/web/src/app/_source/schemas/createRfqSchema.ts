import { z } from 'zod';

const createRfqSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  sourceType: z.enum(['excel', 'email_text', 'manual']),
  sourceFileName: z.string().optional(),
  rawInputText: z
    .string()
    .transform((val) => val?.replace(/\x00/g, ''))
    .optional(),
  distributorName: z.string().optional(),
  distributorEmail: z
    .string()
    .transform((val) => (val === '' ? undefined : val))
    .pipe(z.string().email().optional()),
  distributorCompany: z.string().optional(),
  distributorNotes: z.string().optional(),
  responseDeadline: z.date().optional(),
});

export default createRfqSchema;
