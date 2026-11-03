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
  /** The day it departed, YYYY-MM-DD, asked for when none is recorded */
  departedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
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
      const { id, status, notes, departedAt } = input;

      // Noon UTC, so the date reads the same in Dubai and London
      const shipment = await setShipmentStatus({
        id,
        status,
        notes,
        userId: user.id,
        departedAt: departedAt ? new Date(`${departedAt}T12:00:00Z`) : undefined,
      });

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
