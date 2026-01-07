import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { getAllNotificationTypes } from '@/app/_notifications/data/getNotificationCategories';
import db from '@/database/client';
import type { User } from '@/database/schema';
import { users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

const validTypes = getAllNotificationTypes();

const inputSchema = z.object({
  disabledTypes: z.array(z.string()).refine(
    (types) =>
      types.every((t) => validTypes.includes(t as (typeof validTypes)[number])),
    { message: 'Invalid notification type' },
  ),
});

/**
 * Update user's notification preferences
 *
 * Sets which notification types the user has disabled
 */
const notificationPreferencesUpdate = protectedProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { disabledTypes } = input;

    // Get current preferences to preserve admin settings
    const currentUser = await db.query.users.findFirst({
      where: { id: user.id },
      columns: {
        notificationPreferences: true,
      },
    });

    const currentPreferences = currentUser?.notificationPreferences as
      | User['notificationPreferences']
      | undefined;

    // Update preferences, preserving admin disabled types
    await db
      .update(users)
      .set({
        notificationPreferences: {
          disabledTypes,
          adminDisabledTypes: currentPreferences?.adminDisabledTypes ?? [],
        },
      })
      .where(eq(users.id, user.id));

    return { success: true };
  });

export default notificationPreferencesUpdate;
