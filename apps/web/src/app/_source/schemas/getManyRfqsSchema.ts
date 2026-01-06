import { z } from 'zod';

import { sourceRfqStatus } from '@/database/schema';

const getManyRfqsSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.number().min(0).default(0),
  search: z.string().optional(),
  status: z.enum(sourceRfqStatus.enumValues).optional(),
});

export default getManyRfqsSchema;
