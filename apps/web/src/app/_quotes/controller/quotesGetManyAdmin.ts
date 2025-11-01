import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { quotes, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getQuotesSchema from '../schemas/getQuotesSchema';

/**
 * Get list of ALL quotes for admin users with pagination and filters
 *
 * Unlike quotesGetMany, this endpoint returns quotes from all users,
 * not just the current admin's quotes.
 *
 * @example
 *   await trpcClient.quotes.getManyAdmin.query({
 *     limit: 20,
 *     cursor: 0,
 *     search: "hotel",
 *     status: "buy_request_submitted"
 *   });
 */
const quotesGetManyAdmin = adminProcedure
  .input(getQuotesSchema)
  .query(async ({ input }) => {
    const { limit, cursor, search, status } = input;

    // Build where conditions - NOTE: No userId filter for admin
    const conditions = [];

    if (status) {
      conditions.push(eq(quotes.status, status));
    }

    if (search) {
      conditions.push(
        or(
          ilike(quotes.name, `%${search}%`),
          ilike(quotes.clientName, `%${search}%`),
          ilike(quotes.clientCompany, `%${search}%`),
        )!,
      );
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(quotes)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const totalCount = Number(countResult?.count ?? 0);

    // Get quotes with pagination, including user information
    const quotesList = await db
      .select({
        quote: quotes,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(quotes.createdAt))
      .limit(limit)
      .offset(cursor);

    // Flatten the response to include user info at the top level
    const quotesWithUser = quotesList.map((row) => ({
      ...row.quote,
      createdBy: row.user,
    }));

    const nextCursor = cursor + limit < totalCount ? cursor + limit : null;

    return {
      data: quotesWithUser,
      meta: {
        totalCount,
        nextCursor,
        hasMore: nextCursor !== null,
      },
    };
  });

export default quotesGetManyAdmin;
