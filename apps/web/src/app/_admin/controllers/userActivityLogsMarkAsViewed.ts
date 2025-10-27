import { eq } from 'drizzle-orm';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import db from '@/database/client';
import { users } from '@/database/schema';

/**
 * Mark all activities as viewed for the current user
 *
 * Updates the user's lastViewedActivityAt timestamp to now
 */
const userActivityLogsMarkAsViewed = async () => {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id;

    await db
      .update(users)
      .set({
        lastViewedActivityAt: new Date(),
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    // Gracefully handle if column doesn't exist yet
    console.warn('Could not mark activities as viewed:', error);
    return { success: false, error: 'Column not available yet' };
  }
};

export default userActivityLogsMarkAsViewed;
