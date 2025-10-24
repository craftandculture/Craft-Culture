import { desc, eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { adminActivityLogs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get admin activity logs with pagination
 */
const adminActivityLogsGetMany = adminProcedure
  .input(
    z.object({
      adminId: z.string().uuid().optional(),
      action: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }),
  )
  .query(async ({ input }) => {
    const { adminId, action, limit, offset } = input;

    // Build where conditions
    const whereConditions: SQL[] = [];
    if (adminId) {
      whereConditions.push(eq(adminActivityLogs.adminId, adminId));
    }
    if (action) {
      whereConditions.push(eq(adminActivityLogs.action, action));
    }

    // Fetch logs with admin user information
    const logs = await db.query.adminActivityLogs.findMany({
      where:
        whereConditions.length > 0
          ? (_table) =>
              whereConditions.reduce((acc, condition) => {
                return acc ? acc.and(condition) : condition;
              })
          : undefined,
      orderBy: [desc(adminActivityLogs.createdAt)],
      limit,
      offset,
      with: {
        admin: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Get total count for pagination
    const totalCount = await db.query.adminActivityLogs.findMany({
      where:
        whereConditions.length > 0
          ? (_table) =>
              whereConditions.reduce((acc, condition) => {
                return acc ? acc.and(condition) : condition;
              })
          : undefined,
      columns: { id: true },
    });

    return {
      data: logs,
      meta: {
        totalCount: totalCount.length,
        limit,
        offset,
        hasMore: offset + limit < totalCount.length,
      },
    };
  });

export default adminActivityLogsGetMany;
