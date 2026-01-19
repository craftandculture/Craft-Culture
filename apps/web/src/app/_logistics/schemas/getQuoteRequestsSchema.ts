import { z } from 'zod';

/**
 * Schema for listing quote requests with filtering and pagination
 */
const getQuoteRequestsSchema = z.object({
  // Pagination
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.string().uuid().optional(),

  // Filters
  status: z.enum(['pending', 'in_progress', 'quoted', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  requestedBy: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),

  // Search
  search: z.string().optional(),
});

export default getQuoteRequestsSchema;
