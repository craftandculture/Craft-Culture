import { z } from 'zod';

/**
 * Schema for listing freight quotes with filters and pagination
 */
const getQuotesSchema = z.object({
  // Pagination
  limit: z.number().int().positive().max(100).default(20),
  cursor: z.string().uuid().optional(),

  // Filters
  status: z.enum(['draft', 'pending', 'accepted', 'rejected', 'expired']).optional(),
  forwarderName: z.string().optional(),
  shipmentId: z.string().uuid().optional(),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']).optional(),

  // Search
  search: z.string().optional(),

  // Date range
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
});

export default getQuotesSchema;
