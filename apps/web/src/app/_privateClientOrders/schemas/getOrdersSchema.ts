import { z } from 'zod';

import { privateClientOrderStatus } from '@/database/schema';

/**
 * Schema for querying private client orders with pagination and filters
 */
const getOrdersSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.number().min(0).default(0),
  search: z.string().optional(),
  status: z.enum(privateClientOrderStatus.enumValues).optional(),
  clientId: z.string().uuid().optional(),
});

export default getOrdersSchema;
