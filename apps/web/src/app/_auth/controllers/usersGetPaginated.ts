import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { sessions, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get paginated list of users with filtering and search
 *
 * Admin-only endpoint for user management
 */
const usersGetPaginated = adminProcedure
  .input(
    z.object({
      cursor: z.number().optional().default(0),
      limit: z.number().optional().default(50),
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
      customerType: z.enum(['b2b', 'b2c', 'private_clients']).optional(),
      search: z.string().optional(),
    }),
  )
  .query(async ({ input }) => {
    const { cursor, limit, status, customerType, search } = input;

    const whereConditions = [];

    // Filter by approval status
    if (status) {
      whereConditions.push(eq(users.approvalStatus, status));
    }

    // Filter by customer type
    if (customerType) {
      whereConditions.push(eq(users.customerType, customerType));
    }

    // Search by name or email
    if (search && search.trim().length > 0) {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(
        or(ilike(users.name, searchTerm), ilike(users.email, searchTerm)),
      );
    }

    const whereClause =
      whereConditions.length > 0
        ? sql`${sql.join(whereConditions, sql` AND `)}`
        : undefined;

    // Subquery to get the most recent session (last login) for each user
    const lastLoginSubquery = db
      .select({
        userId: sessions.userId,
        lastLogin: sql<Date>`MAX(${sessions.createdAt})`.as('last_login'),
      })
      .from(sessions)
      .groupBy(sessions.userId)
      .as('last_login_sq');

    // Get users with pagination and last login
    const usersResult = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        customerType: users.customerType,
        role: users.role,
        approvalStatus: users.approvalStatus,
        approvedAt: users.approvedAt,
        approvedBy: users.approvedBy,
        isTestUser: users.isTestUser,
        createdAt: users.createdAt,
        onboardingCompletedAt: users.onboardingCompletedAt,
        lastLogin: lastLoginSubquery.lastLogin,
      })
      .from(users)
      .leftJoin(lastLoginSubquery, eq(users.id, lastLoginSubquery.userId))
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit + 1)
      .offset(cursor);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(whereClause);

    const nextCursor = usersResult.length > limit ? cursor + limit : undefined;

    return {
      data: usersResult.slice(0, limit),
      meta: {
        nextCursor,
        totalCount: countResult?.count ?? 0,
      },
    };
  });

export type UsersGetPaginatedOutput = Awaited<ReturnType<typeof usersGetPaginated>>;

export default usersGetPaginated;
