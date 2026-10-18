import { and, desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { notificationType, notifications } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import notificationActionTypes from '../constants/notificationActionTypes';
import getNotificationsSchema from '../schemas/getNotificationsSchema';
import getNotificationArea from '../utils/getNotificationArea';

/**
 * Get paginated notifications for the current user
 *
 * Filters combine: "Needs action" is unread and an action type, and an area
 * narrows either view to the types filed under it.
 *
 * TODO: Re-enable partnerId filtering once migration is applied
 * The partner_id column needs to be added to the notifications table first.
 */
const notificationsGetMany = protectedProcedure
  .input(getNotificationsSchema)
  .query(async ({ ctx, input }) => {
    const { limit, cursor, unreadOnly, actionOnly, area } = input;
    const userId = ctx.user.id;

    const conditions = [eq(notifications.userId, userId)];

    if (unreadOnly || actionOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    if (actionOnly) {
      conditions.push(inArray(notifications.type, [...notificationActionTypes]));
    }

    if (area) {
      const types = notificationType.enumValues.filter(
        (type) => getNotificationArea(type) === area,
      );
      conditions.push(inArray(notifications.type, types));
    }

    const data = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit + 1)
      .offset(cursor);

    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, -1) : data;

    return {
      data: items,
      nextCursor: hasMore ? cursor + limit : null,
    };
  });

export default notificationsGetMany;
