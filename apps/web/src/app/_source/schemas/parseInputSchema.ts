import { z } from 'zod';

const parseInputSchema = z.object({
  rfqId: z.string().uuid(),
  inputType: z.enum(['excel', 'email_text']),
  content: z.string().min(1, 'Content is required'),
  fileName: z.string().optional(),
});

export default parseInputSchema;
