'use server';

import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import type { User } from '@/database/schema';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

/**
 * Server action to mark all activities as viewed for the current user
 *
 * Updates the user's lastViewedActivityAt timestamp to mark all current activities as read
 */
const markActivitiesAsViewed = async () => {
  const queryClient = getQueryClient();

  const [userData, userError] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  const user = userData as User | undefined;

  if (userError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  await db
    .update(users)
    .set({
      lastViewedActivityAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return { success: true };
};

export default markActivitiesAsViewed;
