import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsQuoteRequests,
  logisticsShipmentActivityLogs,
  logisticsShipments,
} from '@/database/schema';

import defaultJobType from '../utils/defaultJobType';
import generateShipmentNumber from '../utils/generateShipmentNumber';
import isUniqueViolation from '../utils/isUniqueViolation';

type JobType = 'inbound' | 'outbound' | 're_export' | 'mainland_transfer';

/**
 * Open the job (a draft SHP shipment) a freight request is quoted for
 *
 * Every request belongs to a job, so quotes are never collected for work that
 * is not in the system. The job takes the request's route; its mode is the
 * request's, or air until a quote is accepted and sets the real one. A request
 * that already has its job keeps it.
 *
 * @example
 *   const job = await openJobForRequest(request, {
 *     type: 'inbound',
 *     userId,
 *   });
 *
 * @param request - The saved request
 * @param options - The job type (read from the route when omitted) and who
 *   opened it
 * @returns The job's id and SHP number
 */
const openJobForRequest = async (
  request: typeof logisticsQuoteRequests.$inferSelect,
  options: { type?: JobType; userId: string },
) => {
  if (request.shipmentId) {
    const [existing] = await db
      .select({
        id: logisticsShipments.id,
        shipmentNumber: logisticsShipments.shipmentNumber,
      })
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, request.shipmentId))
      .limit(1);

    if (existing) return existing;
  }

  let job: { id: string; shipmentNumber: string } | undefined;

  for (let attempt = 0; attempt < 3 && !job; attempt++) {
    const shipmentNumber = await generateShipmentNumber();

    try {
      [job] = await db
        .insert(logisticsShipments)
        .values({
          shipmentNumber,
          type:
            options.type ??
            defaultJobType(request.originCountry, request.destinationCountry),
          transportMode: request.transportMode ?? 'air',
          status: 'draft',
          originCountry: request.originCountry,
          originCity: request.originCity,
          originWarehouse: request.originWarehouse,
          destinationCountry: request.destinationCountry,
          destinationCity: request.destinationCity,
          destinationWarehouse: request.destinationWarehouse,
          totalCases: request.totalCases ?? undefined,
          internalNotes: `Opened for freight quotes ${request.requestNumber}`,
          createdBy: options.userId,
        })
        .returning({
          id: logisticsShipments.id,
          shipmentNumber: logisticsShipments.shipmentNumber,
        });
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 2) continue;
      throw error;
    }
  }

  if (!job) {
    throw new Error('Shipment insert returned no row');
  }

  await db.insert(logisticsShipmentActivityLogs).values({
    shipmentId: job.id,
    userId: options.userId,
    action: 'created',
    newStatus: 'draft',
    notes: `Job ${job.shipmentNumber} opened for freight quotes ${request.requestNumber}`,
  });

  await db
    .update(logisticsQuoteRequests)
    .set({ shipmentId: job.id, updatedAt: new Date() })
    .where(eq(logisticsQuoteRequests.id, request.id));

  return job;
};

export default openJobForRequest;
