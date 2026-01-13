import { z } from 'zod';

import { sourceSupplierOrderStatus } from '@/database/schema';

const getManySupplierOrdersSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.number().min(0).default(0),
  status: z.enum(sourceSupplierOrderStatus.enumValues).optional(),
});

export default getManySupplierOrdersSchema;
