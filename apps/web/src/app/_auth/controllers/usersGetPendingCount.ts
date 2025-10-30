import { count, eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get count of users pending approval
 *
 * Admin-only query that returns the number of users with approvalStatus='pending'
 * Used for notification badges and alerts
 *
 * @returns Object with count of pending users
 */
const usersGetPendingCount = adminProcedure.query(async () => {
  const [result] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.approvalStatus, 'pending'));

  return {
    count: result?.count ?? 0,
  };
});

export default usersGetPendingCount;
