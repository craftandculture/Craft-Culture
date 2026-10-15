import { z } from 'zod';

import isVercelBlobUrl from '@/utils/isVercelBlobUrl';

/**
 * Schema for submitting payment proof to a quote
 */
const submitPaymentProofSchema = z.object({
  quoteId: z.string().uuid(),
  paymentProofUrl: z
    .string()
    .url()
    .refine(isVercelBlobUrl, 'Unrecognised file location'),
});

export default submitPaymentProofSchema;
