import { and, desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { notifications } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/trpc';

import getNotificationsSchema from '../schemas/getNotificationsSchema';

/**
 * Get paginated notifications for the current user
 */
const notificationsGetMany = protectedProcedure
  .input(getNotificationsSchema)
  .query(async ({ ctx, input }) => {
    const { limit, cursor, unreadOnly } = input;
    const userId = ctx.user.id;

    const whereConditions = unreadOnly
      ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      : eq(notifications.userId, userId);

    const data = await db.query.notifications.findMany({
      where: whereConditions,
      orderBy: [desc(notifications.createdAt)],
      limit: limit + 1,
      offset: cursor,
    });

    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, -1) : data;

    return {
      data: items,
      nextCursor: hasMore ? cursor + limit : null,
    };
  });

export default notificationsGetMany;
