import getNotificationCategories from '@/app/_notifications/data/getNotificationCategories';
import db from '@/database/client';
import type { User } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Get user's notification preferences
 *
 * Returns all notification types organized by category with enabled/disabled state
 */
const notificationPreferencesGet = protectedProcedure.query(
  async ({ ctx: { user } }) => {
    const userSettings = await db.query.users.findFirst({
      where: { id: user.id },
      columns: {
        notificationPreferences: true,
      },
    });

    const preferences = userSettings?.notificationPreferences as
      | User['notificationPreferences']
      | undefined;

    const categories = getNotificationCategories();

    // Map categories with enabled state for each type
    const categoriesWithState = categories.map((category) => ({
      ...category,
      types: category.types.map((typeInfo) => ({
        ...typeInfo,
        enabled: !preferences?.disabledTypes?.includes(typeInfo.type),
        adminDisabled:
          preferences?.adminDisabledTypes?.includes(typeInfo.type) ?? false,
      })),
    }));

    return {
      categories: categoriesWithState,
    };
  },
);

export default notificationPreferencesGet;
