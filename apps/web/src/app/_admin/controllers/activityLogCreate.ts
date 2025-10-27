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
  ctx: { headers: Headers },
) => {
  const user = await getUserOrRedirect();

  // Extract IP and User Agent from request headers
  const ipAddress = ctx.headers.get('x-forwarded-for') ?? ctx.headers.get('x-real-ip');
  const userAgent = ctx.headers.get('user-agent');

  await logUserActivity({
    userId: user.id,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });

  return { success: true };
};

export default activityLogCreate;
