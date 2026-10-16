import { and, asc, count, desc, eq, ilike, inArray, lt, or } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsQuoteRequests, logisticsQuotes, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getQuoteRequestsSchema from '../schemas/getQuoteRequestsSchema';

/**
 * List quote requests with filtering and pagination
 *
 * Returns requests with requester info and the quotes received against each
 * one, and supports filtering by status, priority, and assignment.
 */
const adminGetQuoteRequests = adminProcedure
  .input(getQuoteRequestsSchema)
  .query(async ({ input }) => {
    const { limit, cursor, status, priority, requestedBy, assignedTo, search } = input;

    // Build where conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(logisticsQuoteRequests.status, status));
    }

    if (priority) {
      conditions.push(eq(logisticsQuoteRequests.priority, priority));
    }

    if (requestedBy) {
      conditions.push(eq(logisticsQuoteRequests.requestedBy, requestedBy));
    }

    if (assignedTo) {
      conditions.push(eq(logisticsQuoteRequests.assignedTo, assignedTo));
    }

    if (search) {
      conditions.push(
        or(
          ilike(logisticsQuoteRequests.requestNumber, `%${search}%`),
          ilike(logisticsQuoteRequests.originCountry, `%${search}%`),
          ilike(logisticsQuoteRequests.destinationCountry, `%${search}%`),
          ilike(logisticsQuoteRequests.productDescription, `%${search}%`),
        ),
      );
    }

    // Add cursor for pagination
    if (cursor) {
      const cursorRequest = await db.query.logisticsQuoteRequests.findFirst({
        where: { id: cursor },
        columns: { createdAt: true },
      });

      if (cursorRequest) {
        conditions.push(lt(logisticsQuoteRequests.createdAt, cursorRequest.createdAt));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get requests with requester info
    const requests = await db
      .select({
        id: logisticsQuoteRequests.id,
        requestNumber: logisticsQuoteRequests.requestNumber,
        status: logisticsQuoteRequests.status,
        priority: logisticsQuoteRequests.priority,
        originCountry: logisticsQuoteRequests.originCountry,
        originCity: logisticsQuoteRequests.originCity,
        destinationCountry: logisticsQuoteRequests.destinationCountry,
        destinationCity: logisticsQuoteRequests.destinationCity,
        transportMode: logisticsQuoteRequests.transportMode,
        productType: logisticsQuoteRequests.productType,
        totalCases: logisticsQuoteRequests.totalCases,
        totalPallets: logisticsQuoteRequests.totalPallets,
        totalWeightKg: logisticsQuoteRequests.totalWeightKg,
        requiresThermalLiner: logisticsQuoteRequests.requiresThermalLiner,
        requiresTracker: logisticsQuoteRequests.requiresTracker,
        targetPickupDate: logisticsQuoteRequests.targetPickupDate,
        targetDeliveryDate: logisticsQuoteRequests.targetDeliveryDate,
        requestedAt: logisticsQuoteRequests.requestedAt,
        createdAt: logisticsQuoteRequests.createdAt,
        requester: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(logisticsQuoteRequests)
      .leftJoin(users, eq(logisticsQuoteRequests.requestedBy, users.id))
      .where(whereClause)
      .orderBy(desc(logisticsQuoteRequests.createdAt))
      .limit(limit + 1);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(logisticsQuoteRequests)
      .where(whereClause);

    // Check if there are more results
    const hasMore = requests.length > limit;
    const items = hasMore ? requests.slice(0, -1) : requests;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    // The quotes each request has received, cheapest first
    const requestIds = items.map((r) => r.id);
    const quoteRows = requestIds.length
      ? await db
          .select({
            id: logisticsQuotes.id,
            requestId: logisticsQuotes.requestId,
            quoteNumber: logisticsQuotes.quoteNumber,
            forwarderName: logisticsQuotes.forwarderName,
            totalPrice: logisticsQuotes.totalPrice,
            currency: logisticsQuotes.currency,
            transitDays: logisticsQuotes.transitDays,
            status: logisticsQuotes.status,
            validUntil: logisticsQuotes.validUntil,
          })
          .from(logisticsQuotes)
          .where(inArray(logisticsQuotes.requestId, requestIds))
          .orderBy(asc(logisticsQuotes.totalPrice))
      : [];

    return {
      requests: items.map((r) => ({
        ...r,
        quotes: quoteRows.filter((q) => q.requestId === r.id),
      })),
      totalCount: countResult?.count ?? 0,
      nextCursor,
    };
  });

export default adminGetQuoteRequests;
