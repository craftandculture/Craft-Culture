'use server';

import { eq } from 'drizzle-orm';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import db from '@/database/client';
import { users } from '@/database/schema';

/**
 * Server action to mark all activities as viewed for the current user
 */
const markActivitiesAsViewed = async () => {
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

export default markActivitiesAsViewed;
