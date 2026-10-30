import { and, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import { logisticsShipments } from '@/database/schema';

import { noNewsWhere } from './noNews';
import NOT_ARRIVED_STATUSES from './notArrivedStatuses';
import type { ShipmentDue } from './shipmentDueKeys';

const DAY = 24 * 60 * 60 * 1000;

/** Bound as text: a raw Date inside a sql template fails at runtime */
const at = (date: Date) => sql`${date.toISOString()}::timestamp`;

/**
 * Shipments due something soon, or overdue
 *
 * One definition for the dashboard tiles, the shipments list tiles and the
 * filter each opens, so a tile's count is what it lists.
 *
 * - late: still on its way, its ETA passed and no arrival logged
 * - ships_7d: not yet departed, its ETD between today and seven days on
 * - arrives_7d: not yet arrived, its ETA between now and seven days on
 *
 * @param due - Which tile
 * @param now - The moment to judge by
 * @returns A where-clause
 */
export const shipmentDueWhere = (due: ShipmentDue, now = new Date()) => {
  const notArrived = inArray(logisticsShipments.status, [...NOT_ARRIVED_STATUSES]);
  const week = new Date(now.getTime() + 7 * DAY);
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  if (due === 'late') {
    return and(
      notArrived,
      isNull(logisticsShipments.ata),
      isNotNull(logisticsShipments.eta),
      sql`${logisticsShipments.eta} < ${at(now)}`,
    );
  }
  if (due === 'ships_7d') {
    return and(
      notArrived,
      isNull(logisticsShipments.atd),
      sql`${logisticsShipments.etd} >= ${at(today)}`,
      sql`${logisticsShipments.etd} < ${at(week)}`,
    );
  }
  return and(
    notArrived,
    isNull(logisticsShipments.ata),
    sql`${logisticsShipments.eta} >= ${at(now)}`,
    sql`${logisticsShipments.eta} < ${at(week)}`,
  );
};

/**
 * Counts for the four timing tiles, as one select's columns
 *
 * @example
 *   db.select(shipmentDueCountsSelect()).from(logisticsShipments).where(baseWhere);
 */
export const shipmentDueCountsSelect = (now = new Date()) => ({
  late: sql<number>`count(*) filter (where ${shipmentDueWhere('late', now)})`.mapWith(Number),
  ships_7d: sql<number>`count(*) filter (where ${shipmentDueWhere('ships_7d', now)})`.mapWith(Number),
  arrives_7d: sql<number>`count(*) filter (where ${shipmentDueWhere('arrives_7d', now)})`.mapWith(Number),
  no_news: sql<number>`count(*) filter (where ${noNewsWhere(now)})`.mapWith(Number),
});
