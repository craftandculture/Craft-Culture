import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { logisticsQuoteRequests } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import createQuoteRequestSchema from '../schemas/createQuoteRequestSchema';
import generateRequestNumber from '../utils/generateRequestNumber';

/**
 * Create a new quote request
 *
 * Allows sales team to request freight quotes from logistics.
 * Request numbers are auto-generated in format QRQ-YYYY-XXXX.
 */
const adminCreateQuoteRequest = protectedProcedure
  .input(createQuoteRequestSchema)
  .mutation(async ({ input, ctx }) => {
    try {
      const requestNumber = await generateRequestNumber();

      const [request] = await db
        .insert(logisticsQuoteRequests)
        .values({
          requestNumber,
          status: 'pending',
          priority: input.priority,
          requestedBy: ctx.user.id,
          originCountry: input.originCountry,
          originCity: input.originCity || null,
          originWarehouse: input.originWarehouse || null,
          destinationCountry: input.destinationCountry,
          destinationCity: input.destinationCity || null,
          destinationWarehouse: input.destinationWarehouse || null,
          transportMode: input.transportMode || null,
          productType: input.productType,
          productDescription: input.productDescription || null,
          totalCases: input.totalCases || null,
          totalPallets: input.totalPallets || null,
          totalWeightKg: input.totalWeightKg || null,
          totalVolumeM3: input.totalVolumeM3 || null,
          requiresThermalLiner: input.requiresThermalLiner,
          requiresTracker: input.requiresTracker,
          requiresInsurance: input.requiresInsurance,
          temperatureControlled: input.temperatureControlled,
          minTemperature: input.minTemperature || null,
          maxTemperature: input.maxTemperature || null,
          targetPickupDate: input.targetPickupDate || null,
          targetDeliveryDate: input.targetDeliveryDate || null,
          isFlexibleDates: input.isFlexibleDates,
          notes: input.notes || null,
        })
        .returning();

      logger.info('Created quote request', {
        requestId: request.id,
        requestNumber,
        requestedBy: ctx.user.id,
      });

      return request;
    } catch (error) {
      logger.error('Failed to create quote request', { error, input });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create quote request',
      });
    }
  });

export default adminCreateQuoteRequest;
