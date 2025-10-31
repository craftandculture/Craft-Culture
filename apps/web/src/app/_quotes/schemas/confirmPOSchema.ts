import { z } from 'zod';

/**
 * Schema for C&C confirming a PO
 */
const confirmPOSchema = z.object({
  quoteId: z.string().uuid(),
  deliveryLeadTime: z.string().min(1, 'Delivery lead time is required'),
  poConfirmationNotes: z.string().optional(),
});

export default confirmPOSchema;
