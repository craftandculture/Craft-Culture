import { and, desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { notifications } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import getNotificationsSchema from '../schemas/getNotificationsSchema';

/**
 * Get paginated notifications for the current user
 *
 * TODO: Re-enable partnerId filtering once migration is applied
 * The partner_id column needs to be added to the notifications table first.
 */
const notificationsGetMany = protectedProcedure
  .input(getNotificationsSchema)
  .query(async ({ ctx, input }) => {
    const { limit, cursor, unreadOnly } = input;
    const userId = ctx.user.id;

    // Build conditions:
    // - Must be for this user
    // - Optionally filter to unread only
    const conditions = [eq(notifications.userId, userId)];

    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
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
