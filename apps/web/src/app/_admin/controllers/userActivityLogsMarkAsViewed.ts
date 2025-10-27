import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import getCurrentUserId from '@/utils/getCurrentUserId';

/**
 * Mark all activities as viewed for the current user
 *
 * Updates the user's lastViewedActivityAt timestamp to now
 */
const userActivityLogsMarkAsViewed = async () => {
  const userId = await getCurrentUserId();

  await db
    .update(users)
    .set({
      lastViewedActivityAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { success: true };
};

export default userActivityLogsMarkAsViewed;
