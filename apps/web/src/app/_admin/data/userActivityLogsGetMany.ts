import { desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { userActivityLogs, users } from '@/database/schema';

interface UserActivityLogsGetManyParams {
  limit?: number;
  offset?: number;
  userId?: string;
  action?: string;
  unreadOnly?: boolean;
}

/**
 * Get many user activity logs with user information
 *
 * @param params - Query parameters for filtering and pagination
 * @returns Activity logs with user details
 */
const userActivityLogsGetMany = async (params: UserActivityLogsGetManyParams) => {
  const { limit = 50, offset = 0, userId, action, unreadOnly: _unreadOnly = false } = params;

  const whereConditions = [];

  if (userId) {
    whereConditions.push(eq(userActivityLogs.userId, userId));
  }

  if (action) {
    whereConditions.push(eq(userActivityLogs.action, action));
  }

  // Note: unreadOnly filter temporarily disabled - requires database migration
  // if (unreadOnly) {
  //   // Filter logic will be re-enabled after adding lastViewedActivityAt column
  // }

  const logs = await db
    .select({
      id: userActivityLogs.id,
      userId: userActivityLogs.userId,
      action: userActivityLogs.action,
      entityType: userActivityLogs.entityType,
      entityId: userActivityLogs.entityId,
      metadata: userActivityLogs.metadata,
      ipAddress: userActivityLogs.ipAddress,
      userAgent: userActivityLogs.userAgent,
      createdAt: userActivityLogs.createdAt,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        customerType: users.customerType,
      },
    })
    .from(userActivityLogs)
    .leftJoin(users, eq(userActivityLogs.userId, users.id))
    .where(whereConditions.length > 0 ? sql`${sql.join(whereConditions, sql` AND `)}` : undefined)
    .orderBy(desc(userActivityLogs.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userActivityLogs)
    .where(whereConditions.length > 0 ? sql`${sql.join(whereConditions, sql` AND `)}` : undefined);

  return {
    logs,
    total: countResult?.count ?? 0,
  };
};

export default userActivityLogsGetMany;
