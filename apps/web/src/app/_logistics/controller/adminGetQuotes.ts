import { and, count, desc, eq, gt, ilike, or } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsQuotes, logisticsShipments, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getQuotesSchema from '../schemas/getQuotesSchema';

/**
 * List freight quotes with filters and pagination
 *
 * Returns paginated list of quotes with optional filtering by status,
 * forwarder, shipment, and transport mode. Includes cursor-based pagination.
 */
const adminGetQuotes = adminProcedure.input(getQuotesSchema).query(async ({ input }) => {
  const { limit, cursor, status, forwarderName, shipmentId, transportMode, search } = input;

  // Build WHERE conditions
  const conditions = [];

  if (status) {
    conditions.push(eq(logisticsQuotes.status, status));
  }

  if (forwarderName) {
    conditions.push(ilike(logisticsQuotes.forwarderName, `%${forwarderName}%`));
  }

  if (shipmentId) {
    conditions.push(eq(logisticsQuotes.shipmentId, shipmentId));
  }

  if (transportMode) {
    conditions.push(eq(logisticsQuotes.transportMode, transportMode));
  }

  if (search) {
    conditions.push(
      or(
        ilike(logisticsQuotes.quoteNumber, `%${search}%`),
        ilike(logisticsQuotes.forwarderName, `%${search}%`),
        ilike(logisticsQuotes.notes, `%${search}%`),
      ),
    );
  }

  if (cursor) {
    // Get the cursor quote's createdAt for pagination
    const [cursorQuote] = await db
      .select({ createdAt: logisticsQuotes.createdAt })
      .from(logisticsQuotes)
      .where(eq(logisticsQuotes.id, cursor))
      .limit(1);

    if (cursorQuote) {
      conditions.push(gt(logisticsQuotes.createdAt, cursorQuote.createdAt));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get quotes with related data
  const quotes = await db
    .select({
      quote: logisticsQuotes,
      shipment: {
        id: logisticsShipments.id,
        shipmentNumber: logisticsShipments.shipmentNumber,
      },
      createdByUser: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(logisticsQuotes)
    .leftJoin(logisticsShipments, eq(logisticsQuotes.shipmentId, logisticsShipments.id))
    .leftJoin(users, eq(logisticsQuotes.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(logisticsQuotes.createdAt))
    .limit(limit + 1);

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(logisticsQuotes)
    .where(whereClause);

  const hasMore = quotes.length > limit;
  const items = hasMore ? quotes.slice(0, -1) : quotes;
  const nextCursor = hasMore ? items[items.length - 1]?.quote.id : undefined;

  return {
    quotes: items.map((row) => ({
      ...row.quote,
      shipment: row.shipment?.id ? row.shipment : null,
      createdByUser: row.createdByUser?.id ? row.createdByUser : null,
    })),
    totalCount: countResult?.count ?? 0,
    nextCursor,
    hasMore,
  };
});

export default adminGetQuotes;
