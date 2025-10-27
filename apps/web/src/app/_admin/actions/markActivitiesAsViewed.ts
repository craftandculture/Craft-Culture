'use server';

import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import getCurrentUserId from '@/utils/getCurrentUserId';

/**
 * Server action to mark all activities as viewed for the current user
 */
const markActivitiesAsViewed = async () => {
  const userId = await getCurrentUserId();

  await db
    .update(users)
    .set({
      lastViewedActivityAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { success: true };
};

export default markActivitiesAsViewed;
