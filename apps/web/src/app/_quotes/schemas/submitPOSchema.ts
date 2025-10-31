import { z } from 'zod';

/**
 * Schema for submitting a PO on a confirmed quote
 */
const submitPOSchema = z.object({
  quoteId: z.string().uuid(),
  poNumber: z.string().min(1, 'PO number is required'),
  poAttachmentUrl: z.string().url().optional(),
  deliveryLeadTime: z.string().min(1, 'Delivery lead time is required'),
});

export default submitPOSchema;
