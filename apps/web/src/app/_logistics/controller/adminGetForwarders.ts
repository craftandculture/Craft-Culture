import { and, asc, count, eq, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsForwarders, logisticsQuoteRequests, logisticsQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * List forwarders on file, flagging those that have quoted on a route
 *
 * The request page ticks the forwarders that have quoted this route before,
 * so the usual names are chosen without anyone looking them up.
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

    return forwarders.map((f) => ({
      ...f,
      quoteCount: countBy.get(f.id) ?? 0,
      usedOnRoute: routeIds.has(f.id),
    }));
  });

export default adminGetForwarders;
