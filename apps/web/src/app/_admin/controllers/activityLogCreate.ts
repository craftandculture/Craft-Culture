import { headers } from 'next/headers';
import type { z } from 'zod';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import logUserActivity from '@/utils/logUserActivity';

import type activityLogCreateInputSchema from '../schemas/activityLogCreateInputSchema';

/**
 * Log a user activity for admin monitoring
 *
 * @param input - Activity data to log
 * @returns Success status
 */
const activityLogCreate = async (
  input: z.infer<typeof activityLogCreateInputSchema>,
) => {
  const user = await getUserOrRedirect();

  // Extract IP and User Agent from request headers
  const headersList = await headers();
  // Vercel sets x-real-ip to the connecting client and overwrites
  // x-forwarded-for, so prefer x-real-ip and only take the first hop otherwise
  const ipAddress =
    headersList.get('x-real-ip')?.trim() ||
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null;
  const userAgent = headersList.get('user-agent')?.slice(0, 500) ?? null;

  await logUserActivity({
    userId: user.id,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata,
    ipAddress,
    userAgent,
  });

  return { success: true };
};

export default activityLogCreate;
