import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsQuoteRequestAttachments,
  logisticsQuoteRequests,
  logisticsQuotes,
  users,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single quote request with full details
 *
 * Returns the request with requester info, attachments, and linked quotes.
 */
const adminGetQuoteRequest = adminProcedure
  .input(z.object({ requestId: z.string().uuid() }))
  .query(async ({ input }) => {
    const { requestId } = input;

    // Get request with requester info
    const [request] = await db
      .select({
        id: logisticsQuoteRequests.id,
        requestNumber: logisticsQuoteRequests.requestNumber,
        status: logisticsQuoteRequests.status,
        priority: logisticsQuoteRequests.priority,
        requestedAt: logisticsQuoteRequests.requestedAt,
        assignedAt: logisticsQuoteRequests.assignedAt,
        completedAt: logisticsQuoteRequests.completedAt,
        cancellationReason: logisticsQuoteRequests.cancellationReason,
        originCountry: logisticsQuoteRequests.originCountry,
        originCity: logisticsQuoteRequests.originCity,
        originWarehouse: logisticsQuoteRequests.originWarehouse,
        destinationCountry: logisticsQuoteRequests.destinationCountry,
        destinationCity: logisticsQuoteRequests.destinationCity,
        destinationWarehouse: logisticsQuoteRequests.destinationWarehouse,
        transportMode: logisticsQuoteRequests.transportMode,
        productType: logisticsQuoteRequests.productType,
        productDescription: logisticsQuoteRequests.productDescription,
        totalCases: logisticsQuoteRequests.totalCases,
        totalPallets: logisticsQuoteRequests.totalPallets,
        totalWeightKg: logisticsQuoteRequests.totalWeightKg,
        totalVolumeM3: logisticsQuoteRequests.totalVolumeM3,
        requiresThermalLiner: logisticsQuoteRequests.requiresThermalLiner,
        requiresTracker: logisticsQuoteRequests.requiresTracker,
        requiresInsurance: logisticsQuoteRequests.requiresInsurance,
        temperatureControlled: logisticsQuoteRequests.temperatureControlled,
        minTemperature: logisticsQuoteRequests.minTemperature,
        maxTemperature: logisticsQuoteRequests.maxTemperature,
        targetPickupDate: logisticsQuoteRequests.targetPickupDate,
        targetDeliveryDate: logisticsQuoteRequests.targetDeliveryDate,
        isFlexibleDates: logisticsQuoteRequests.isFlexibleDates,
        notes: logisticsQuoteRequests.notes,
        internalNotes: logisticsQuoteRequests.internalNotes,
        createdAt: logisticsQuoteRequests.createdAt,
        updatedAt: logisticsQuoteRequests.updatedAt,
      })
      .from(logisticsQuoteRequests)
      .where(eq(logisticsQuoteRequests.id, requestId));

    if (!request) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote request not found',
      });
    }

    // Get requester info
    const [requestData] = await db
      .select({
        requestedBy: logisticsQuoteRequests.requestedBy,
        assignedTo: logisticsQuoteRequests.assignedTo,
        completedBy: logisticsQuoteRequests.completedBy,
      })
      .from(logisticsQuoteRequests)
      .where(eq(logisticsQuoteRequests.id, requestId));

    const [requester] = requestData?.requestedBy
      ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, requestData.requestedBy))
      : [null];

    const [assignee] = requestData?.assignedTo
      ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, requestData.assignedTo))
      : [null];

    const [completedByUser] = requestData?.completedBy
      ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, requestData.completedBy))
      : [null];

    // Get attachments
    const attachments = await db
      .select()
      .from(logisticsQuoteRequestAttachments)
      .where(eq(logisticsQuoteRequestAttachments.requestId, requestId));

    // Get linked quotes
    const quotes = await db
      .select({
        id: logisticsQuotes.id,
        quoteNumber: logisticsQuotes.quoteNumber,
        forwarderName: logisticsQuotes.forwarderName,
        totalPrice: logisticsQuotes.totalPrice,
        currency: logisticsQuotes.currency,
        transitDays: logisticsQuotes.transitDays,
        status: logisticsQuotes.status,
        validUntil: logisticsQuotes.validUntil,
        createdAt: logisticsQuotes.createdAt,
      })
      .from(logisticsQuotes)
      .where(eq(logisticsQuotes.requestId, requestId));

    return {
      ...request,
      requester,
      assignee,
      completedByUser,
      attachments,
      quotes,
    };
  });

export default adminGetQuoteRequest;
