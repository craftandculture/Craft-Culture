'use server';

import { eq } from 'drizzle-orm';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import db from '@/database/client';
import { users } from '@/database/schema';

/**
 * Server action to mark all activities as viewed for the current user
 */
const markActivitiesAsViewed = async () => {
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
};

export default markActivitiesAsViewed;
