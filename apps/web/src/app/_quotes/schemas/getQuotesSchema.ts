import { z } from 'zod';

/**
 * Schema for listing quotes with pagination and filters
 *
 * @example
 *   {
 *     limit: 20,
 *     cursor: 0,
 *     search: "hotel",
 *     status: "draft"
 *   }
 */
const getQuotesSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.number().int().min(0).default(0),
  search: z.string().optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
});

export type GetQuotesSchema = z.infer<typeof getQuotesSchema>;

export default getQuotesSchema;
