import { and, desc, eq, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import db from '@/database/client';
import { logisticsJobs, logisticsShipmentItems, logisticsShipments, users } from '@/database/schema';

import getBondClaimsDue from '../notifications/getBondClaimsDue';
import { lastNewsSql, noNewsWhere } from '../utils/noNews';
import NOT_ARRIVED from '../utils/notArrivedStatuses';

const actionOwner = alias(users, 'action_owner');

const DAY = 24 * 60 * 60 * 1000;

/**
 * What on the logistics board needs someone to act, grouped by reason
 *
 * Each group is a count and the shipments behind it, so the dashboard can lead
 * with the exceptions instead of a list of everything. Only shipments from the
 * last 90 days are checked, so old history never crowds the list.
 *
 * - No cases or bottles: neither line items nor counts typed on the job
 * - ETA passed: due, but not yet at the warehouse or delivered
 * - Export job with no invoice: no Zoho number and no C&C export invoice linked
 * - Draft for over 7 days: opened and never moved on
 * - No news for 48 hours: on its way, pipeline drafts included, and nobody
 *   has logged an update or moved its status, oldest news first
 * - Bond claims due or missed: bonded export jobs whose movement bond claim
 *   is due within 14 days or past its deadline, with the days left on each
 *
 * Shared by the dashboard's Needs attention card and the #logistics digest, so
 * the two always list the same things.
 *
 * @param now - The moment to judge by
 * @returns The groups, each with its shipments
 */
const getAttentionGroups = async (now = new Date()) => {
  const since = new Date(now.getTime() - 90 * DAY);
  const weekAgo = new Date(now.getTime() - 7 * DAY);

  const cases = sql<number>`COALESCE((
    SELECT SUM(${logisticsShipmentItems.cases})
    FROM ${logisticsShipmentItems}
    WHERE ${logisticsShipmentItems.shipmentId} = ${logisticsShipments.id}
  ), ${logisticsShipments.totalCases}, 0)`;

  const columns = {
    id: logisticsShipments.id,
    shipmentNumber: logisticsShipments.shipmentNumber,
    name: logisticsShipments.name,
    type: logisticsShipments.type,
    status: logisticsShipments.status,
    originCity: logisticsShipments.originCity,
    destinationCity: logisticsShipments.destinationCity,
    eta: logisticsShipments.eta,
    jobNumber: logisticsJobs.jobNumber,
    clientName: logisticsJobs.clientName,
    nextAction: logisticsShipments.nextAction,
    actionOwnerName: actionOwner.name,
    lastNewsAt: lastNewsSql,
  };

  const base = () =>
    db
      .select(columns)
      .from(logisticsShipments)
      .leftJoin(logisticsJobs, eq(logisticsJobs.shipmentId, logisticsShipments.id))
      .leftJoin(actionOwner, eq(logisticsShipments.nextActionOwnerId, actionOwner.id));

  const live = and(gte(logisticsShipments.createdAt, since), ne(logisticsShipments.status, 'cancelled'));

  const [noQuantities, overdue, noInvoice, staleDrafts, bondsDue, noNews] = await Promise.all([
    base()
      .where(and(live, sql`${cases} = 0`))
      .orderBy(desc(logisticsShipments.createdAt))
      .limit(25),
    base()
      .where(and(live, lt(logisticsShipments.eta, now), inArray(logisticsShipments.status, [...NOT_ARRIVED])))
      .orderBy(logisticsShipments.eta)
      .limit(25),
    base()
      .where(
        and(
          live,
          eq(logisticsJobs.kind, 'export'),
          isNull(logisticsJobs.invoiceNumber),
          isNull(logisticsJobs.exportInvoiceId),
        ),
      )
      .orderBy(desc(logisticsShipments.createdAt))
      .limit(25),
    base()
      .where(
        and(
          live,
          eq(logisticsShipments.status, 'draft'),
          lt(logisticsShipments.createdAt, weekAgo),
        ),
      )
      .orderBy(logisticsShipments.createdAt)
      .limit(25),
    getBondClaimsDue(now),
    base().where(and(live, noNewsWhere(now))).orderBy(lastNewsSql).limit(25),
  ]);

  return [
    { key: 'no_quantities', label: 'No cases or bottles entered', shipments: noQuantities },
    { key: 'overdue', label: 'ETA passed, not yet received', shipments: overdue },
    { key: 'no_invoice', label: 'Export jobs with no invoice', shipments: noInvoice },
    { key: 'stale_draft', label: 'Draft for over 7 days', shipments: staleDrafts },
    { key: 'bond_claims', label: 'Bond claims due or missed', shipments: bondsDue.slice(0, 25) },
    { key: 'no_news', label: 'No news for 48 hours', shipments: noNews },
  ];
};

export default getAttentionGroups;
