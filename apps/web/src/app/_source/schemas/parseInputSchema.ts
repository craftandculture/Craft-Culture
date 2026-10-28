import { z } from 'zod';

const parseInputSchema = z.object({
  rfqId: z.string().uuid(),
  inputType: z.enum(['excel', 'email_text']),
  content: z
    .string()
    .max(14_000_000, 'File is too large (10 MB limit)')
    .transform((val) => val.replace(/\x00/g, ''))
    .pipe(z.string().min(1, 'Content is required')),
  fileName: z.string().optional(),
});

export default parseInputSchema;
