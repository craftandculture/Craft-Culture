import { z } from 'zod';

const declineRfqSchema = z.object({
  rfqId: z.string().uuid(),
  reason: z.string().optional(),
});

export default declineRfqSchema;
