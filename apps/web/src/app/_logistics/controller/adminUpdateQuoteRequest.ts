import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsQuoteRequests } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import updateQuoteRequestSchema from '../schemas/updateQuoteRequestSchema';

/**
 * Update a quote request
 *
 * Allows updating request details including status changes.
 * Handles special status transitions like cancellation.
 */
const adminUpdateQuoteRequest = adminProcedure
  .input(updateQuoteRequestSchema)
  .mutation(async ({ input, ctx }) => {
    const { requestId, ...updateData } = input;

    // Get current request
    const [existing] = await db
      .select()
      .from(logisticsQuoteRequests)
      .where(eq(logisticsQuoteRequests.id, requestId));

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote request not found',
      });
    }

    // Build update object
    const updates: Partial<typeof logisticsQuoteRequests.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Handle status changes
    if (updateData.status) {
      updates.status = updateData.status;

      if (updateData.status === 'completed') {
        updates.completedAt = new Date();
        updates.completedBy = ctx.user.id;
      }

      if (updateData.status === 'cancelled') {
        updates.cancellationReason = updateData.cancellationReason || null;
      }
    }

    // Handle field updates
    if (updateData.priority !== undefined) updates.priority = updateData.priority;
    if (updateData.originCountry !== undefined) updates.originCountry = updateData.originCountry;
    if (updateData.originCity !== undefined) updates.originCity = updateData.originCity;
    if (updateData.originWarehouse !== undefined) updates.originWarehouse = updateData.originWarehouse;
    if (updateData.destinationCountry !== undefined) updates.destinationCountry = updateData.destinationCountry;
    if (updateData.destinationCity !== undefined) updates.destinationCity = updateData.destinationCity;
    if (updateData.destinationWarehouse !== undefined) updates.destinationWarehouse = updateData.destinationWarehouse;
    if (updateData.transportMode !== undefined) updates.transportMode = updateData.transportMode;
    if (updateData.productType !== undefined) updates.productType = updateData.productType;
    if (updateData.productDescription !== undefined) updates.productDescription = updateData.productDescription;
    if (updateData.totalCases !== undefined) updates.totalCases = updateData.totalCases;
    if (updateData.totalPallets !== undefined) updates.totalPallets = updateData.totalPallets;
    if (updateData.totalWeightKg !== undefined) updates.totalWeightKg = updateData.totalWeightKg;
    if (updateData.totalVolumeM3 !== undefined) updates.totalVolumeM3 = updateData.totalVolumeM3;
    if (updateData.requiresThermalLiner !== undefined) updates.requiresThermalLiner = updateData.requiresThermalLiner;
    if (updateData.requiresTracker !== undefined) updates.requiresTracker = updateData.requiresTracker;
    if (updateData.requiresInsurance !== undefined) updates.requiresInsurance = updateData.requiresInsurance;
    if (updateData.temperatureControlled !== undefined) updates.temperatureControlled = updateData.temperatureControlled;
    if (updateData.minTemperature !== undefined) updates.minTemperature = updateData.minTemperature;
    if (updateData.maxTemperature !== undefined) updates.maxTemperature = updateData.maxTemperature;
    if (updateData.targetPickupDate !== undefined) updates.targetPickupDate = updateData.targetPickupDate;
    if (updateData.targetDeliveryDate !== undefined) updates.targetDeliveryDate = updateData.targetDeliveryDate;
    if (updateData.isFlexibleDates !== undefined) updates.isFlexibleDates = updateData.isFlexibleDates;
    if (updateData.notes !== undefined) updates.notes = updateData.notes;
    if (updateData.internalNotes !== undefined) updates.internalNotes = updateData.internalNotes;

    const [updated] = await db
      .update(logisticsQuoteRequests)
      .set(updates)
      .where(eq(logisticsQuoteRequests.id, requestId))
      .returning();

    logger.info('Updated quote request', {
      requestId,
      status: updateData.status,
      updatedBy: ctx.user.id,
    });

    return updated;
  });

export default adminUpdateQuoteRequest;
