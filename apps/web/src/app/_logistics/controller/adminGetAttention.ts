import { and, desc, eq, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsJobs, logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const DAY = 24 * 60 * 60 * 1000;

/** Statuses a shipment has not yet reached the warehouse or client in */
const NOT_ARRIVED = [
  'draft',
  'booked',
  'picked_up',
  'in_transit',
  'arrived_port',
  'customs_clearance',
  'cleared',
] as const;

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
 */
const adminGetAttention = adminProcedure.query(async () => {
  const now = new Date();
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
  };

  const base = () =>
    db
      .select(columns)
      .from(logisticsShipments)
      .leftJoin(logisticsJobs, eq(logisticsJobs.shipmentId, logisticsShipments.id));

  const live = and(gte(logisticsShipments.createdAt, since), ne(logisticsShipments.status, 'cancelled'));

  const [noQuantities, overdue, noInvoice, staleDrafts] = await Promise.all([
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
  ]);

  return [
    { key: 'no_quantities', label: 'No cases or bottles entered', shipments: noQuantities },
    { key: 'overdue', label: 'ETA passed, not yet received', shipments: overdue },
    { key: 'no_invoice', label: 'Export jobs with no invoice', shipments: noInvoice },
    { key: 'stale_draft', label: 'Draft for over 7 days', shipments: staleDrafts },
  ];
});

export default adminGetAttention;
