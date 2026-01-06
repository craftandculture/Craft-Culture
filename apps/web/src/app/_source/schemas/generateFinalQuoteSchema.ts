import { z } from 'zod';

const generateFinalQuoteSchema = z.object({
  rfqId: z.string().uuid(),
});

export default generateFinalQuoteSchema;
