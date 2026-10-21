import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsQuoteRequests } from '@/database/schema';

/**
 * Suggest a client price from what was last charged on the same route
 *
 * The last request from the same origin country to the same destination
 * country, by the same mode where one is set, that carried a client price:
 * its price per 75cl equivalent, applied to this load. A starting point to
 * change, not a rule, and null when the route has no history.
 *
 * @example
 *   await getSuggestedClientPrice(request); // { priceUsd: 3150, per75clUsd: 2.83, fromRequestNumber: 'QRQ-2026-0009' }
 *
 * @param request - The request being priced
 * @returns The suggested total and where it came from, or null
 */
const getSuggestedClientPrice = async (request: {
  id: string;
  originCountry: string;
  destinationCountry: string;
  transportMode: string | null;
  total75clEquivalents: number | null;
}) => {
  if (!request.total75clEquivalents) return null;

  const [last] = await db
    .select({
      requestNumber: logisticsQuoteRequests.requestNumber,
      clientPriceUsd: logisticsQuoteRequests.clientPriceUsd,
      equivalents: logisticsQuoteRequests.total75clEquivalents,
    })
    .from(logisticsQuoteRequests)
    .where(
      and(
        ne(logisticsQuoteRequests.id, request.id),
        isNotNull(logisticsQuoteRequests.clientPriceUsd),
        sql`${logisticsQuoteRequests.total75clEquivalents} > 0`,
        sql`lower(${logisticsQuoteRequests.originCountry}) = lower(${request.originCountry})`,
        sql`lower(${logisticsQuoteRequests.destinationCountry}) = lower(${request.destinationCountry})`,
        request.transportMode
          ? eq(logisticsQuoteRequests.transportMode, request.transportMode as 'air')
          : undefined,
      ),
    )
    .orderBy(desc(logisticsQuoteRequests.updatedAt))
    .limit(1);

  if (!last?.clientPriceUsd || !last.equivalents) return null;

  const per75clUsd = last.clientPriceUsd / last.equivalents;

  return {
    priceUsd: Math.round(per75clUsd * request.total75clEquivalents * 100) / 100,
    per75clUsd: Math.round(per75clUsd * 100) / 100,
    fromRequestNumber: last.requestNumber,
  };
};

export default getSuggestedClientPrice;
