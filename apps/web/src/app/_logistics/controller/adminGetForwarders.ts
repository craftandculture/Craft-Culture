import { and, asc, count, eq, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsForwarders, logisticsQuoteRequests, logisticsQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import normaliseCountry from '../utils/normaliseCountry';

/**
 * List forwarders on file, flagging those that have quoted on a route
 *
 * A new request ticks the forwarders that have quoted this route before or
 * that collect from its origin country, so the usual names are chosen without
 * anyone looking them up.
 *
 * @example
 *   await trpcClient.logistics.admin.forwarders.getMany.query({ originCountry: 'United Kingdom', destinationCountry: 'United Arab Emirates' });
 */
const adminGetForwarders = adminProcedure
  .input(
    z
      .object({
        originCountry: z.string().optional(),
        destinationCountry: z.string().optional(),
        includeInactive: z.boolean().optional(),
      })
      .optional(),
  )
  .query(async ({ input }) => {
    const forwarders = await db
      .select()
      .from(logisticsForwarders)
      .where(input?.includeInactive ? undefined : eq(logisticsForwarders.isActive, true))
      .orderBy(asc(logisticsForwarders.name));

    const quoteCounts = await db
      .select({ forwarderId: logisticsQuotes.forwarderId, quotes: count() })
      .from(logisticsQuotes)
      .where(isNotNull(logisticsQuotes.forwarderId))
      .groupBy(logisticsQuotes.forwarderId);

    // Same route = same origin and destination country, on the quote or the request it answered
    const onRoute =
      input?.originCountry && input.destinationCountry
        ? await db
            .selectDistinct({ forwarderId: logisticsQuotes.forwarderId })
            .from(logisticsQuotes)
            .leftJoin(logisticsQuoteRequests, eq(logisticsQuoteRequests.id, logisticsQuotes.requestId))
            .where(
              and(
                isNotNull(logisticsQuotes.forwarderId),
                sql`lower(coalesce(${logisticsQuoteRequests.originCountry}, ${logisticsQuotes.originCountry})) = lower(${input.originCountry})`,
                sql`lower(coalesce(${logisticsQuoteRequests.destinationCountry}, ${logisticsQuotes.destinationCountry})) = lower(${input.destinationCountry})`,
              ),
            )
        : [];

    const countBy = new Map(quoteCounts.map((r) => [r.forwarderId, r.quotes]));
    const routeIds = new Set(onRoute.map((r) => r.forwarderId));

    const origin = input?.originCountry ? normaliseCountry(input.originCountry).toLowerCase() : null;

    return forwarders.map((f) => ({
      ...f,
      quoteCount: countBy.get(f.id) ?? 0,
      usedOnRoute: routeIds.has(f.id),
      /** Collects from the request's origin country, as set on the forwarder */
      coversRoute: !!origin && f.originCountries.some((c) => c.toLowerCase() === origin),
    }));
  });

export default adminGetForwarders;
