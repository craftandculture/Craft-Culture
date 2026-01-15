import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentActivityLogs, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import updateShipmentSchema from '../schemas/updateShipmentSchema';

/**
 * Update a logistics shipment
 *
 * @example
 *   await trpcClient.logistics.admin.update.mutate({
 *     id: "uuid",
 *     carrierName: "Hillebrand",
 *     containerNumber: "HLCU1234567"
 *   });
 */
const adminUpdate = adminProcedure
  .input(updateShipmentSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    try {
      const { id, ...updates } = input;

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

      // Calculate total landed cost if cost fields are being updated
      const costFields = [
        'freightCostUsd',
        'insuranceCostUsd',
        'originHandlingUsd',
        'destinationHandlingUsd',
        'customsClearanceUsd',
        'govFeesUsd',
        'deliveryCostUsd',
        'otherCostsUsd',
      ] as const;

      type CostField = (typeof costFields)[number];
      const hasCostUpdate = costFields.some(
        (field) => updates[field as CostField] !== undefined,
      );

      let totalLandedCostUsd: number | undefined;

      if (hasCostUpdate) {
        totalLandedCostUsd = costFields.reduce((sum, field) => {
          const value =
            updates[field as CostField] ?? (existing[field as CostField] as number | null);
          return sum + (value ?? 0);
        }, 0);
      }

      // Update the shipment
      const [shipment] = await db
        .update(logisticsShipments)
        .set({
          ...updates,
          ...(totalLandedCostUsd !== undefined && { totalLandedCostUsd }),
        })
        .where(eq(logisticsShipments.id, id))
        .returning();

      if (!shipment) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update shipment',
        });
      }

      // Log the update
      await db.insert(logisticsShipmentActivityLogs).values({
        shipmentId: id,
        userId: user.id,
        action: 'updated',
        metadata: { updatedFields: Object.keys(updates) },
        notes: `Shipment updated`,
      });

      return shipment;
    } catch (error) {
      logger.error('Error updating shipment:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update shipment. Please try again.',
      });
    }
  });

export default adminUpdate;
