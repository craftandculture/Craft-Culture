import { and, inArray, sql } from 'drizzle-orm';

import { logisticsShipments } from '@/database/schema';

import NOT_ARRIVED_STATUSES from './notArrivedStatuses';

/** A shipment not yet at the warehouse with no news for this long needs chasing */
export const NO_NEWS_HOURS = 48;

/** When news was last logged, or when the shipment was opened if never */
export const lastNewsSql = sql<Date>`COALESCE(${logisticsShipments.lastUpdateAt}, ${logisticsShipments.createdAt})`;

/**
 * Shipments still on their way, pipeline drafts included, that have gone quiet
 *
 * One definition for the board's filter, the Needs attention card and the
 * morning digest, so a shipment is "no news" in all three or in none.
 *
 * @param now - The moment to judge by
 * @returns A where-clause
 */
export const noNewsWhere = (now = new Date()) =>
  and(
    inArray(logisticsShipments.status, [...NOT_ARRIVED_STATUSES]),
    // Bound as text: a raw Date inside a sql template fails at runtime
    sql`${lastNewsSql} < ${new Date(now.getTime() - NO_NEWS_HOURS * 60 * 60 * 1000).toISOString()}::timestamp`,
  );
