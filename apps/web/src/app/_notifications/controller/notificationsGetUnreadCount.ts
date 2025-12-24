import { and, count, eq } from 'drizzle-orm';

import db from '@/database/client';
import { notifications } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Get count of unread notifications for the current user
 */
const notificationsGetUnreadCount = protectedProcedure.query(async ({ ctx }) => {
  const userId = ctx.user.id;

  const [result] = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return {
    count: result?.count ?? 0,
  };
});

export default notificationsGetUnreadCount;
