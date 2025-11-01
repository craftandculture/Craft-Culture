import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { quotes, users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import getQuotesSchema from '../schemas/getQuotesSchema';

/**
 * Get list of quotes for the current user with pagination and filters
 *
 * @example
 *   await trpcClient.quotes.getMany.query({
 *     limit: 20,
 *     cursor: 0,
 *     search: "hotel",
 *     status: "draft"
 *   });
 */
const quotesGetMany = protectedProcedure
  .input(getQuotesSchema)
  .query(async ({ input, ctx: { user } }) => {
    const { limit, cursor, search, status } = input;

    // Build where conditions
    const conditions = [eq(quotes.userId, user.id)];

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
      .where(and(...conditions));

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
      .where(and(...conditions))
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

export default quotesGetMany;
