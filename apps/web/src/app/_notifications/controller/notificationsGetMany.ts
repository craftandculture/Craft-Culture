import db from '@/database/client';
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

    const whereConditions = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const data = await db.query.notifications.findMany({
      where: whereConditions,
      orderBy: (table, { desc }) => [desc(table.createdAt)],
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
