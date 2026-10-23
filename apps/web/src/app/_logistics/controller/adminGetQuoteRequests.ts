import { and, asc, count, desc, eq, ilike, inArray, lt, or } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsForwarders,
  logisticsQuoteRequestRecipients,
  logisticsQuoteRequests,
  logisticsQuotes,
  logisticsShipments,
  users,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getQuoteRequestsSchema from '../schemas/getQuoteRequestsSchema';
import quoteRequestNextStep from '../utils/quoteRequestNextStep';
import quoteTotalUsd from '../utils/quoteTotalUsd';
import quoteUnitPrices from '../utils/quoteUnitPrices';
import requestUnitCounts from '../utils/requestUnitCounts';

/**
 * List quote requests with filtering and pagination
 *
 * Returns requests with requester info and the quotes received against each
 * one, and supports filtering by status, priority, and assignment.
 */
const adminGetQuoteRequests = adminProcedure
  .input(getQuoteRequestsSchema)
  .query(async ({ input }) => {
    const { limit, cursor, status, priority, requestedBy, assignedTo, search } =
      input;

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
          ilike(logisticsQuoteRequests.clientName, `%${search}%`),
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
        conditions.push(
          lt(logisticsQuoteRequests.createdAt, cursorRequest.createdAt),
        );
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get requests with requester info
    const requests = await db
      .select({
        id: logisticsQuoteRequests.id,
        requestNumber: logisticsQuoteRequests.requestNumber,
        clientName: logisticsQuoteRequests.clientName,
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
        totalBottles: logisticsQuoteRequests.totalBottles,
        total75clEquivalents: logisticsQuoteRequests.total75clEquivalents,
        replyBy: logisticsQuoteRequests.replyBy,
        clientPriceUsd: logisticsQuoteRequests.clientPriceUsd,
        clientQuoteId: logisticsQuoteRequests.clientQuoteId,
        clientQuotedAt: logisticsQuoteRequests.clientQuotedAt,
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
        /** The SHP job the request is quoted for */
        job: {
          id: logisticsShipments.id,
          shipmentNumber: logisticsShipments.shipmentNumber,
          status: logisticsShipments.status,
        },
        jobBottles: logisticsShipments.totalBottles,
      })
      .from(logisticsQuoteRequests)
      .leftJoin(users, eq(logisticsQuoteRequests.requestedBy, users.id))
      .leftJoin(
        logisticsShipments,
        eq(logisticsShipments.id, logisticsQuoteRequests.shipmentId),
      )
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
            totalUsd: logisticsQuotes.totalUsd,
            transitDays: logisticsQuotes.transitDays,
            status: logisticsQuotes.status,
            validUntil: logisticsQuotes.validUntil,
          })
          .from(logisticsQuotes)
          .where(inArray(logisticsQuotes.requestId, requestIds))
          .orderBy(asc(logisticsQuotes.totalPrice))
      : [];

    const recipientRows = requestIds.length
      ? await db
          .select({
            requestId: logisticsQuoteRequestRecipients.requestId,
            forwarderId: logisticsQuoteRequestRecipients.forwarderId,
            name: logisticsForwarders.name,
            sentAt: logisticsQuoteRequestRecipients.sentAt,
            chasedAt: logisticsQuoteRequestRecipients.chasedAt,
            outcome: logisticsQuoteRequestRecipients.outcome,
          })
          .from(logisticsQuoteRequestRecipients)
          .innerJoin(
            logisticsForwarders,
            eq(
              logisticsForwarders.id,
              logisticsQuoteRequestRecipients.forwarderId,
            ),
          )
          .where(inArray(logisticsQuoteRequestRecipients.requestId, requestIds))
          .orderBy(asc(logisticsForwarders.name))
      : [];

    return {
      requests: items.map(({ jobBottles, ...r }) => {
        const counts = requestUnitCounts(r, jobBottles);

        // Ranked in USD per 75cl, so a quote in pounds and one in dollars compare
        const quotes = quoteRows
          .filter((q) => q.requestId === r.id)
          .map((q) => {
            const usd = quoteTotalUsd(q);

            return {
              ...q,
              totalUsd: usd,
              ...quoteUnitPrices(usd, counts.bottles, counts.equivalents),
            };
          })
          .sort(
            (a, b) =>
              (a.per75clUsd ?? a.totalUsd ?? Number.MAX_VALUE) -
              (b.per75clUsd ?? b.totalUsd ?? Number.MAX_VALUE),
          );
        const recipients = recipientRows.filter((x) => x.requestId === r.id);
        const chosen = quotes.find((q) => q.id === r.clientQuoteId);

        return {
          ...r,
          bottles: counts.bottles,
          bottlesFrom: counts.bottlesFrom,
          quotes,
          recipients,
          nextStep: quoteRequestNextStep({ ...r, quotes, recipients }),
          marginUsd:
            r.clientPriceUsd != null && chosen?.totalUsd != null
              ? Math.round((r.clientPriceUsd - chosen.totalUsd) * 100) / 100
              : null,
        };
      }),
      totalCount: countResult?.count ?? 0,
      nextCursor,
    };
  });

export default adminGetQuoteRequests;
