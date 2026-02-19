import { tasks } from '@trigger.dev/sdk/v3';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentActivityLogs, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { shipmentMilestoneNotificationJob } from '@/trigger/jobs/logistics-alerts/shipmentMilestoneNotificationJob';
import logger from '@/utils/logger';

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
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
  ]),
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

      // Get current shipment
      const [existing] = await db
        .select()
        .from(logisticsShipments)
        .where(eq(logisticsShipments.id, id));

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shipment not found',
        });
      }

      const previousStatus = existing.status;

      // Update timestamp based on status
      const timestampUpdates: Record<string, Date> = {};
      const now = new Date();

      if (status === 'delivered') {
        timestampUpdates.deliveredAt = now;
      }

      if (status === 'at_warehouse' && !existing.ata) {
        timestampUpdates.ata = now;
      }

      // Update the shipment status
      const [shipment] = await db
        .update(logisticsShipments)
        .set({
          status,
          ...timestampUpdates,
        })
        .where(eq(logisticsShipments.id, id))
        .returning();

      if (!shipment) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update shipment status',
        });
      }

      // Log the status change
      await db.insert(logisticsShipmentActivityLogs).values({
        shipmentId: id,
        userId: user.id,
        action: 'status_changed',
        previousStatus,
        newStatus: status,
        notes,
      });

      // Trigger milestone notification job (fire and forget)
      tasks
        .trigger(shipmentMilestoneNotificationJob.id, {
          shipmentId: id,
          newStatus: status,
          previousStatus,
          triggeredBy: user.id,
        })
        .catch((err) => {
          logger.error('Failed to trigger milestone notification', { err, shipmentId: id });
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
