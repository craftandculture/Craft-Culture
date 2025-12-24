import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { notifications } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/trpc';

/**
 * Mark all notifications as read for the current user
 */
const notificationsMarkAllAsRead = protectedProcedure.mutation(async ({ ctx }) => {
  const userId = ctx.user.id;

  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return { success: true };
});

export default notificationsMarkAllAsRead;
