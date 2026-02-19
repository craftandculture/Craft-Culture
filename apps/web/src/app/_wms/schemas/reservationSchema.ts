import { z } from 'zod';

/**
 * Schema for querying order reservations
 *
 * @example
 *   getOrderReservationsSchema.parse({
 *     orderId: 'uuid',
 *     orderType: 'zoho',
 *   });
 */
const getOrderReservationsSchema = z.object({
  orderId: z.string().uuid(),
  orderType: z.enum(['zoho', 'pco']),
});

export default getOrderReservationsSchema;
