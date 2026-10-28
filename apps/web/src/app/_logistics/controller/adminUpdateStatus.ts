import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import setShipmentStatus from '../data/setShipmentStatus';
import { SHIPMENT_STATUS_KEYS } from '../utils/shipmentStatuses';

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(SHIPMENT_STATUS_KEYS),
  notes: z.string().optional(),
});

/**
 * Update shipment status with audit logging
 *
 * @example
 *   await trpcClient.logistics.admin.updateStatus.mutate({
 *     id: "uuid",
 *     status: "in_transit",
 *     notes: "Departed from Bordeaux port"
 *   });
 */
const adminUpdateStatus = adminProcedure
  .input(updateStatusSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    try {
      const { id, status, notes } = input;

      const shipment = await setShipmentStatus({ id, status, notes, userId: user.id });

      return shipment;
    } catch (error) {
      logger.error('Error updating shipment status:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update shipment status. Please try again.',
      });
    }
  });

export default adminUpdateStatus;
