import { z } from 'zod';

import isVercelBlobUrl from '@/utils/isVercelBlobUrl';

/**
 * Schema for submitting a PO on a confirmed quote
 */
const submitPOSchema = z.object({
  quoteId: z.string().uuid(),
  poNumber: z.string().min(1, 'PO number is required'),
  poAttachmentUrl: z
    .string()
    .url('PO document is required')
    .refine(isVercelBlobUrl, 'Unrecognised file location'),
});

export default submitPOSchema;
