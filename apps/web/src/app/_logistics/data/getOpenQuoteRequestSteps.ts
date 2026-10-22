import { eq, inArray, notInArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsForwarders,
  logisticsQuoteRequestRecipients,
  logisticsQuoteRequests,
  logisticsQuotes,
} from '@/database/schema';

import quoteRequestNextStep from '../utils/quoteRequestNextStep';

/**
 * Every open quote request with the step it is waiting on
 *
 * Feeds the morning digest and the dashboard counts, using the same rule as
 * the Freight quotes list, so the three always agree.
 *
 * @example
 *   const steps = await getOpenQuoteRequestSteps();
 *   steps.filter((r) => r.nextStep === 'chase');
 *
 * @param now - The moment to judge by
 * @returns Open requests with their next step and the forwarders still awaited
 */
const getOpenQuoteRequestSteps = async (now = new Date()) => {
  const requests = await db
    .select({
      id: logisticsQuoteRequests.id,
      requestNumber: logisticsQuoteRequests.requestNumber,
      status: logisticsQuoteRequests.status,
      originCountry: logisticsQuoteRequests.originCountry,
      destinationCountry: logisticsQuoteRequests.destinationCountry,
      clientPriceUsd: logisticsQuoteRequests.clientPriceUsd,
      clientQuotedAt: logisticsQuoteRequests.clientQuotedAt,
      totalCases: logisticsQuoteRequests.totalCases,
      totalBottles: logisticsQuoteRequests.totalBottles,
      totalPallets: logisticsQuoteRequests.totalPallets,
      totalWeightKg: logisticsQuoteRequests.totalWeightKg,
    })
    .from(logisticsQuoteRequests)
    .where(notInArray(logisticsQuoteRequests.status, ['completed', 'cancelled']));

  if (requests.length === 0) return [];

  const ids = requests.map((r) => r.id);
  const [quotes, recipients] = await Promise.all([
    db
      .select({
        requestId: logisticsQuotes.requestId,
        status: logisticsQuotes.status,
        validUntil: logisticsQuotes.validUntil,
      })
      .from(logisticsQuotes)
      .where(inArray(logisticsQuotes.requestId, ids)),
    db
      .select({
        requestId: logisticsQuoteRequestRecipients.requestId,
        name: logisticsForwarders.name,
        sentAt: logisticsQuoteRequestRecipients.sentAt,
        chasedAt: logisticsQuoteRequestRecipients.chasedAt,
        outcome: logisticsQuoteRequestRecipients.outcome,
      })
      .from(logisticsQuoteRequestRecipients)
      .innerJoin(logisticsForwarders, eq(logisticsForwarders.id, logisticsQuoteRequestRecipients.forwarderId))
      .where(inArray(logisticsQuoteRequestRecipients.requestId, ids)),
  ]);

  return requests.map((r) => {
    const own = recipients.filter((x) => x.requestId === r.id);

    return {
      ...r,
      nextStep: quoteRequestNextStep(
        { ...r, recipients: own, quotes: quotes.filter((q) => q.requestId === r.id) },
        now,
      ),
      awaiting: own.filter((x) => x.outcome === 'awaiting' && x.sentAt).map((x) => x.name),
    };
  });
};

export default getOpenQuoteRequestSteps;
