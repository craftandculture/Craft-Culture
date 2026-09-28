import { z } from 'zod';

/**
 * Input for setting the stock status of an order's line items
 */
const stockStatusUpdateSchema = z.object({
  orderId: z.string().uuid(),
  /** Omit to update every line on the order */
  itemIds: z.array(z.string().uuid()).min(1).optional(),
  stockStatus: z.enum([
    'pending',
    'confirmed',
    'in_transit_to_cc',
    'at_cc_bonded',
    'at_cc_ready_for_dispatch',
    'in_transit_to_distributor',
    'at_distributor',
    'delivered',
  ]),
  stockExpectedAt: z.date().optional(),
  stockNotes: z.string().optional(),
});

export default stockStatusUpdateSchema;
