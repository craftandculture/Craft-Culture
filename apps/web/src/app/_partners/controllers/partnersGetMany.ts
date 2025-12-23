import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { partners, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get paginated list of partners with filtering and search
 *
 * Admin-only endpoint for partner management
 */
const partnersGetMany = adminProcedure
  .input(
    z.object({
      cursor: z.number().optional().default(0),
      limit: z.number().optional().default(50),
      type: z.enum(['retailer', 'sommelier', 'distributor']).optional(),
      status: z.enum(['active', 'inactive', 'suspended']).optional(),
      search: z.string().optional(),
    }),
  )
  .query(async ({ input }) => {
    const { cursor, limit, type, status, search } = input;

    const whereConditions = [];

    if (type) {
      whereConditions.push(eq(partners.type, type));
    }

    if (status) {
      whereConditions.push(eq(partners.status, status));
    }

    if (search && search.trim().length > 0) {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(
        or(
          ilike(partners.businessName, searchTerm),
          ilike(partners.businessEmail, searchTerm),
        ),
      );
    }

    const whereClause =
      whereConditions.length > 0
        ? sql`${sql.join(whereConditions, sql` AND `)}`
        : undefined;

    const partnersResult = await db
      .select({
        id: partners.id,
        userId: partners.userId,
        type: partners.type,
        status: partners.status,
        businessName: partners.businessName,
        businessEmail: partners.businessEmail,
        businessPhone: partners.businessPhone,
        commissionRate: partners.commissionRate,
        createdAt: partners.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(partners)
      .leftJoin(users, eq(partners.userId, users.id))
      .where(whereClause)
      .orderBy(desc(partners.createdAt))
      .limit(limit + 1)
      .offset(cursor);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(partners)
      .where(whereClause);

    const nextCursor =
      partnersResult.length > limit ? cursor + limit : undefined;

    return {
      data: partnersResult.slice(0, limit),
      meta: {
        nextCursor,
        totalCount: countResult?.count ?? 0,
      },
    };
  });

export type PartnersGetManyOutput = Awaited<ReturnType<typeof partnersGetMany>>;

export default partnersGetMany;
