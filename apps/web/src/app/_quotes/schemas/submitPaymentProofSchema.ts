import { z } from 'zod';

/**
 * Schema for submitting payment proof to a quote
 */
const submitPaymentProofSchema = z.object({
  quoteId: z.string().uuid(),
  paymentProofUrl: z.string().url(),
});

export default submitPaymentProofSchema;
