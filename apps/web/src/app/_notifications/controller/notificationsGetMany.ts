import { desc } from 'drizzle-orm';

import db from '@/database/client';
import { notifications } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import getNotificationsSchema from '../schemas/getNotificationsSchema';

/**
 * Get paginated notifications for the current user
 */
const notificationsGetMany = protectedProcedure
  .input(getNotificationsSchema)
  .query(async ({ ctx, input }) => {
    const { limit, cursor, unreadOnly } = input;
    const userId = ctx.user.id;

    const data = await db.query.notifications.findMany({
      where: (table, { eq, and }) =>
        unreadOnly
          ? and(eq(table.userId, userId), eq(table.isRead, false))
          : eq(table.userId, userId),
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
