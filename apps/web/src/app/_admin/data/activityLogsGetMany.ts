import { desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { adminActivityLogs, users } from '@/database/schema';

interface ActivityLogsGetManyParams {
  limit?: number;
  offset?: number;
  adminId?: string;
  action?: string;
}

/**
 * Get many activity logs with user information
 *
 * @param params - Query parameters for filtering and pagination
 * @returns Activity logs with admin user details
 */
const activityLogsGetMany = async (params: ActivityLogsGetManyParams) => {
  const { limit = 50, offset = 0, adminId, action } = params;

  const whereConditions = [];

  if (adminId) {
    whereConditions.push(eq(adminActivityLogs.adminId, adminId));
  }

  if (action) {
    whereConditions.push(eq(adminActivityLogs.action, action));
  }

  const logs = await db
    .select({
      id: adminActivityLogs.id,
      adminId: adminActivityLogs.adminId,
      action: adminActivityLogs.action,
      entityType: adminActivityLogs.entityType,
      entityId: adminActivityLogs.entityId,
      metadata: adminActivityLogs.metadata,
      ipAddress: adminActivityLogs.ipAddress,
      userAgent: adminActivityLogs.userAgent,
      createdAt: adminActivityLogs.createdAt,
      admin: {
        id: users.id,
        email: users.email,
        name: users.name,
      },
    })
    .from(adminActivityLogs)
    .leftJoin(users, eq(adminActivityLogs.adminId, users.id))
    .where(whereConditions.length > 0 ? sql`${sql.join(whereConditions, sql` AND `)}` : undefined)
    .orderBy(desc(adminActivityLogs.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adminActivityLogs)
    .where(whereConditions.length > 0 ? sql`${sql.join(whereConditions, sql` AND `)}` : undefined);

  return {
    logs,
    total: countResult?.count ?? 0,
  };
};

export default activityLogsGetMany;
