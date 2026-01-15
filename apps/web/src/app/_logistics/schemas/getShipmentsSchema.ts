import { z } from 'zod';

/**
 * Schema for listing shipments with pagination and filters
 */
const getShipmentsSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.number().min(0).default(0),
  search: z.string().optional(),
  status: z
    .enum([
      'draft',
      'booked',
      'picked_up',
      'in_transit',
      'arrived_port',
      'customs_clearance',
      'cleared',
      'at_warehouse',
      'dispatched',
      'delivered',
      'cancelled',
    ])
    .optional(),
  type: z.enum(['inbound', 'outbound', 're_export']).optional(),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']).optional(),
  partnerId: z.string().uuid().optional(),
});

export default getShipmentsSchema;
