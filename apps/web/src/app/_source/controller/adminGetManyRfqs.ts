import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqs, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getManyRfqsSchema from '../schemas/getManyRfqsSchema';

/**
 * Get list of SOURCE RFQs with pagination and filters
 *
 * @example
 *   await trpcClient.source.admin.getMany.query({
 *     limit: 20,
 *     cursor: 0,
 *     search: "hotel",
 *     status: "sent"
 *   });
 */
const adminGetManyRfqs = adminProcedure
  .input(getManyRfqsSchema)
  .query(async ({ input }) => {
    const { limit, cursor, search, status } = input;

    // Build where conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(sourceRfqs.status, status));
    }

    if (search) {
      conditions.push(
        or(
          ilike(sourceRfqs.name, `%${search}%`),
          ilike(sourceRfqs.rfqNumber, `%${search}%`),
          ilike(sourceRfqs.distributorName, `%${search}%`),
          ilike(sourceRfqs.distributorCompany, `%${search}%`),
        )!,
      );
    }

    // Get total count
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sourceRfqs)
      .where(whereClause);

    const totalCount = Number(countResult?.count ?? 0);

    // Get RFQs with pagination
    const rfqsList = await db
      .select({
        rfq: sourceRfqs,
        createdByUser: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(sourceRfqs)
      .leftJoin(users, eq(sourceRfqs.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(sourceRfqs.createdAt))
      .limit(limit)
      .offset(cursor);

    // Flatten response
    const rfqsWithUser = rfqsList.map((row) => ({
      ...row.rfq,
      createdByUser: row.createdByUser,
    }));

    const nextCursor = cursor + limit < totalCount ? cursor + limit : null;

    return {
      data: rfqsWithUser,
      meta: {
        totalCount,
        nextCursor,
        hasMore: nextCursor !== null,
      },
    };
  });

export default adminGetManyRfqs;
