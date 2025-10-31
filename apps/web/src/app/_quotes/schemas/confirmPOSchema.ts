import { z } from 'zod';

/**
 * Schema for C&C confirming a PO
 */
const confirmPOSchema = z.object({
  quoteId: z.string().uuid(),
  poConfirmationNotes: z.string().optional(),
});

export default confirmPOSchema;
