import { z } from 'zod';

import { sourceCustomerPoStatus } from '@/database/schema';

const getManyCustomerPosSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.number().min(0).default(0),
  search: z.string().optional(),
  status: z.enum(sourceCustomerPoStatus.enumValues).optional(),
  rfqId: z.string().uuid().optional(),
});

export default getManyCustomerPosSchema;
