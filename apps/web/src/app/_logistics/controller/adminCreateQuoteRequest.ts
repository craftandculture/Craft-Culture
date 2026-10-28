import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import {
  logisticsQuoteRequestRecipients,
  logisticsQuoteRequests,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import findOrCreateForwarder from '../data/findOrCreateForwarder';
import openJobForRequest from '../data/openJobForRequest';
import sendFreightEmails from '../data/sendFreightEmails';
import createQuoteRequestSchema from '../schemas/createQuoteRequestSchema';
import generateRequestNumber from '../utils/generateRequestNumber';
import isUniqueViolation from '../utils/isUniqueViolation';
import logisticsEmailTemplateId from '../utils/logisticsEmailTemplateId';
import normaliseCountry from '../utils/normaliseCountry';

/**
 * Create a new quote request
 *
 * Allows sales team to request freight quotes from logistics. Request numbers
 * are auto-generated in format QRQ-YYYY-XXXX.
 *
 * No quotes without a job: a request started from a shipment is quoted for that
 * shipment; any other opens its own job, a draft SHP shipment, as it is saved.
 */
const adminCreateQuoteRequest = adminProcedure
  .input(createQuoteRequestSchema)
  .mutation(async ({ input, ctx }) => {
    try {
      let request: typeof logisticsQuoteRequests.$inferSelect | undefined;
      let requestNumber = '';

      for (let attempt = 0; attempt < 3 && !request; attempt++) {
        requestNumber = await generateRequestNumber();

        try {
          [request] = await db
            .insert(logisticsQuoteRequests)
            .values({
              requestNumber,
              status: 'pending',
              priority: input.priority,
              requestedBy: ctx.user.id,
              originCountry: normaliseCountry(input.originCountry),
              originCity: input.originCity || null,
              originWarehouse: input.originWarehouse || null,
              destinationCountry: normaliseCountry(input.destinationCountry),
              destinationCity: input.destinationCity || null,
              destinationWarehouse: input.destinationWarehouse || null,
              transportMode: input.transportMode || null,
              productType: input.productType,
              productDescription: input.productDescription || null,
              totalCases: input.totalCases || null,
              totalPallets: input.totalPallets || null,
              totalWeightKg: input.totalWeightKg || null,
              totalVolumeM3: input.totalVolumeM3 || null,
              totalBottles: input.totalBottles || null,
              total75clEquivalents: input.total75clEquivalents || null,
              sourceType: input.sourceType ?? null,
              sourceId: input.sourceType ? input.sourceId || null : null,
              shipmentId:
                input.sourceType === 'shipment' ? input.sourceId || null : null,
              clientName: input.clientName || null,
              clientEmail: input.clientEmail || null,
              replyBy: input.replyBy || null,
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
        } catch (error) {
          if (isUniqueViolation(error) && attempt < 2) continue;
          throw error;
        }
      }

      if (!request) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'The database returned no row',
        });
      }

      const job = await openJobForRequest(request, {
        type: input.jobType,
        userId: ctx.user.id,
      });

      const added = await Promise.all(
        (input.newForwarders ?? []).map((f) =>
          findOrCreateForwarder({ name: f.name, email: f.email || null, addedBy: ctx.user.id }),
        ),
      );
      const forwarderIds = [
        ...new Set([...(input.forwarderIds ?? []), ...added.map((f) => f.id)]),
      ];
      const saved = request;

      if (forwarderIds.length) {
        await db
          .insert(logisticsQuoteRequestRecipients)
          .values(
            forwarderIds.map((forwarderId) => ({
              requestId: saved.id,
              forwarderId,
            })),
          )
          .onConflictDoNothing();
      }

      // Saving and sending is one step; a failed send leaves the request saved, its forwarders not marked sent
      const emailResult =
        input.sendNow && forwarderIds.length && logisticsEmailTemplateId()
          ? await sendFreightEmails(
              { requestId: saved.id, kind: 'request', forwarderIds },
              ctx.user,
            ).catch((error) => {
              logger.error('Request saved but not sent', {
                requestId: saved.id,
                error,
              });
              return null;
            })
          : null;

      logger.info('Created quote request', {
        requestId: request.id,
        requestNumber,
        requestedBy: ctx.user.id,
      });

      return { ...request, shipmentId: job.id, job, emailResult };
    } catch (error) {
      logger.error('Failed to create quote request', {
        error: error instanceof Error ? error.message : String(error),
        requestedBy: ctx.user.id,
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create quote request',
      });
    }
  });

export default adminCreateQuoteRequest;
