import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { notifications } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import markAsReadSchema from '../schemas/markAsReadSchema';

/**
 * Mark a single notification as read
 */
const notificationsMarkAsRead = protectedProcedure
  .input(markAsReadSchema)
  .mutation(async ({ ctx, input }) => {
    const { notificationId } = input;
    const userId = ctx.user.id;

    // Verify notification belongs to user
    const notification = await db.query.notifications.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.id, notificationId), eq(table.userId, userId)),
    });

    if (!notification) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Notification not found',
      });
    }

    const [updated] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(notifications.id, notificationId))
      .returning();

    return updated;
  });

export default notificationsMarkAsRead;
