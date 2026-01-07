import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import getNotificationCategories from '@/app/_notifications/data/getNotificationCategories';
import db from '@/database/client';
import type { User } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Admin endpoint to get a user's notification preferences
 *
 * Returns all notification types with their enabled/disabled state,
 * including both user-disabled and admin-disabled types.
 */
const usersAdminGetNotificationPreferences = adminProcedure
  .input(inputSchema)
  .query(async ({ input }) => {
    const { userId } = input;

    const user = await db.query.users.findFirst({
      where: { id: userId },
      columns: {
        id: true,
        name: true,
        notificationPreferences: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    const preferences = user.notificationPreferences as
      | User['notificationPreferences']
      | undefined;

    const categories = getNotificationCategories();

    // Map categories with enabled state for each type
    const categoriesWithState = categories.map((category) => ({
      ...category,
      types: category.types.map((typeInfo) => ({
        ...typeInfo,
        userEnabled: !preferences?.disabledTypes?.includes(typeInfo.type),
        adminDisabled:
          preferences?.adminDisabledTypes?.includes(typeInfo.type) ?? false,
      })),
    }));

    return {
      userId: user.id,
      userName: user.name,
      categories: categoriesWithState,
      summary: {
        userDisabledCount: preferences?.disabledTypes?.length ?? 0,
        adminDisabledCount: preferences?.adminDisabledTypes?.length ?? 0,
      },
    };
  });

export default usersAdminGetNotificationPreferences;
