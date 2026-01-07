import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { getAllNotificationTypes } from '@/app/_notifications/data/getNotificationCategories';
import db from '@/database/client';
import type { User } from '@/database/schema';
import { users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const validTypes = getAllNotificationTypes();

const inputSchema = z.object({
  userId: z.string().uuid(),
  adminDisabledTypes: z.array(z.string()).refine(
    (types) =>
      types.every((t) => validTypes.includes(t as (typeof validTypes)[number])),
    { message: 'Invalid notification type' },
  ),
});

/**
 * Admin endpoint to update a user's notification preferences
 *
 * Allows admin to disable specific notification types for a user.
 * Preserves user's own preferences.
 */
const usersAdminUpdateNotificationPreferences = adminProcedure
  .input(inputSchema)
  .mutation(async ({ input }) => {
    const { userId, adminDisabledTypes } = input;

    // Get current user and their preferences
    const user = await db.query.users.findFirst({
      where: { id: userId },
      columns: {
        id: true,
        notificationPreferences: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    const currentPreferences = user.notificationPreferences as
      | User['notificationPreferences']
      | undefined;

    // Update preferences, preserving user's disabled types
    await db
      .update(users)
      .set({
        notificationPreferences: {
          disabledTypes: currentPreferences?.disabledTypes ?? [],
          adminDisabledTypes,
        },
      })
      .where(eq(users.id, userId));

    return { success: true };
  });

export default usersAdminUpdateNotificationPreferences;
