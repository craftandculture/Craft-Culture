import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { users } from '@/database/schema';
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
      search: z.string().optional(),
    }),
  )
  .query(async ({ input }) => {
    const { cursor, limit, status, search } = input;

    const whereConditions = [];

    // Filter by approval status
    if (status) {
      whereConditions.push(eq(users.approvalStatus, status));
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

    // Get users with pagination
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
        createdAt: users.createdAt,
        onboardingCompletedAt: users.onboardingCompletedAt,
      })
      .from(users)
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
