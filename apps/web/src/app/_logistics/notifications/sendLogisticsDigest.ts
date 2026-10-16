import { and, eq, gte, inArray, lt, lte, ne } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsJobs, logisticsQuotes, logisticsShipments } from '@/database/schema';

import getBondClaimsDue from './getBondClaimsDue';
import { logisticsDigestMessage } from './logisticsSlackMessages';
import postLogisticsSlack from './postLogisticsSlack';
import NOT_ARRIVED_STATUSES from '../utils/notArrivedStatuses';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Post the weekday-morning logistics digest to #logistics
 *
 * Five checks: inbound arrivals due in the next three days, shipments whose
 * ETA has passed without arriving (last 90 days, as on the board), movement
 * bond claims due within 14 days or missed, pending forwarder quotes expiring
 * within seven days, and export jobs shipped whose documents are not yet
 * sent. A quiet morning still posts one line, so silence means a failure.
 *
 * @param now - The moment to judge by
 * @returns The counts posted, and why the post did not go if it did not
 */
const sendLogisticsDigest = async (now = new Date()) => {
  const in3Days = new Date(now.getTime() + 3 * DAY);
  const in7Days = new Date(now.getTime() + 7 * DAY);
  const since = new Date(now.getTime() - 90 * DAY);

  const columns = {
    id: logisticsShipments.id,
    shipmentNumber: logisticsShipments.shipmentNumber,
    name: logisticsShipments.name,
    eta: logisticsShipments.eta,
    jobNumber: logisticsJobs.jobNumber,
  };

  const base = () =>
    db
      .select(columns)
      .from(logisticsShipments)
      .leftJoin(logisticsJobs, eq(logisticsJobs.shipmentId, logisticsShipments.id));

  const [arriving, overdue, bonds, quotes, awaitingDocs] = await Promise.all([
    base()
      .where(
        and(
          eq(logisticsShipments.type, 'inbound'),
          inArray(logisticsShipments.status, [...NOT_ARRIVED_STATUSES]),
          gte(logisticsShipments.eta, now),
          lte(logisticsShipments.eta, in3Days),
        ),
      )
      .orderBy(logisticsShipments.eta),
    base()
      .where(
        and(
          gte(logisticsShipments.createdAt, since),
          ne(logisticsShipments.status, 'cancelled'),
          lt(logisticsShipments.eta, now),
          inArray(logisticsShipments.status, [...NOT_ARRIVED_STATUSES]),
        ),
      )
      .orderBy(logisticsShipments.eta),
    getBondClaimsDue(now),
    db
      .select({
        quoteNumber: logisticsQuotes.quoteNumber,
        forwarderName: logisticsQuotes.forwarderName,
        validUntil: logisticsQuotes.validUntil,
      })
      .from(logisticsQuotes)
      .where(
        and(
          eq(logisticsQuotes.status, 'pending'),
          gte(logisticsQuotes.validUntil, now),
          lte(logisticsQuotes.validUntil, in7Days),
        ),
      )
      .orderBy(logisticsQuotes.validUntil),
    db
      .select({
        shipmentId: logisticsJobs.shipmentId,
        jobNumber: logisticsJobs.jobNumber,
        clientName: logisticsJobs.clientName,
      })
      .from(logisticsJobs)
      .where(and(eq(logisticsJobs.kind, 'export'), eq(logisticsJobs.stage, 'shipped')))
      .orderBy(logisticsJobs.jobNumber),
  ]);

  const failure = await postLogisticsSlack(
    logisticsDigestMessage({ arriving, overdue, bonds, quotes, awaitingDocs }),
  );

  return {
    posted: failure === null,
    reason: failure,
    arriving: arriving.length,
    overdue: overdue.length,
    bonds: bonds.length,
    quotes: quotes.length,
    awaitingDocs: awaitingDocs.length,
  };
};

export default sendLogisticsDigest;
