import { and, count, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm';

import personName from '@/app/_teamTasks/utils/personName';
import db from '@/database/client';
import { logisticsShipments, users } from '@/database/schema';

import { getDigestHealth } from '../notifications/sendLogisticsDigest';
import { noNewsWhere } from '../utils/noNews';
import NOT_ARRIVED_STATUSES from '../utils/notArrivedStatuses';

const DAY = 24 * 60 * 60 * 1000;

/**
 * The logistics board at a glance: how well it is kept, what has gone quiet,
 * what lands this week and who is holding what
 *
 * Read from the same rules as the morning #logistics post, so the dashboard
 * and the post never disagree.
 *
 * @param now - The moment to judge by
 * @returns Health, no-news and arriving counts, and next actions per owner
 */
const getTeamBoard = async (now = new Date()) => {
  const awaiting = inArray(logisticsShipments.status, [...NOT_ARRIVED_STATUSES]);

  const [health, [quiet], [arriving], waiting] = await Promise.all([
    getDigestHealth(now),
    db
      .select({ count: count() })
      .from(logisticsShipments)
      .where(
        and(
          noNewsWhere(now),
          gte(logisticsShipments.createdAt, new Date(now.getTime() - 90 * DAY)),
        ),
      ),
    db
      .select({
        count: count(),
        confirmed: sql<number>`count(*) FILTER (WHERE ${logisticsShipments.etaConfirmed})::int`,
      })
      .from(logisticsShipments)
      .where(
        and(
          awaiting,
          gte(logisticsShipments.eta, now),
          lte(logisticsShipments.eta, new Date(now.getTime() + 7 * DAY)),
        ),
      ),
    db
      .select({ ownerId: users.id, name: users.name, count: count() })
      .from(logisticsShipments)
      .innerJoin(users, eq(logisticsShipments.nextActionOwnerId, users.id))
      .where(and(awaiting, isNotNull(logisticsShipments.nextAction)))
      .groupBy(users.id, users.name),
  ]);

  return {
    health,
    noNews: quiet?.count ?? 0,
    arriving: { count: arriving?.count ?? 0, confirmed: arriving?.confirmed ?? 0 },
    waiting: waiting
      .map((w) => ({ ownerId: w.ownerId, name: personName(w.name).split(' ')[0] ?? w.name, count: w.count }))
      .sort((a, b) => b.count - a.count),
  };
};

export default getTeamBoard;
