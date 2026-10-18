import { and, count, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { notifications } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import notificationActionTypes from '../constants/notificationActionTypes';

/**
 * Get counts of unread notifications for the current user
 *
 * `count` is every unread notification and drives the bell badge;
 * `actionCount` is the unread ones that ask the reader to act.
 */
const notificationsGetUnreadCount = protectedProcedure.query(async ({ ctx }) => {
  const userId = ctx.user.id;
  const unread = and(
    eq(notifications.userId, userId),
    eq(notifications.isRead, false),
  );

  const [[all], [action]] = await Promise.all([
    db.select({ count: count() }).from(notifications).where(unread),
    db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(unread, inArray(notifications.type, [...notificationActionTypes])),
      ),
  ]);

  return {
    count: all?.count ?? 0,
    actionCount: action?.count ?? 0,
  };
});

export default notificationsGetUnreadCount;
