import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { quotes, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const commissionsGetPendingSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  cursor: z.number().min(0).default(0),
  userId: z.string().uuid().optional(),
});

/**
 * Get all pending commission payouts (admin only)
 *
 * Returns quotes with earned commission that hasn't been paid out yet.
 *
 * @example
 *   await trpcClient.commissions.getPending.query({ limit: 50 });
 */
const commissionsGetPending = adminProcedure
  .input(commissionsGetPendingSchema)
  .query(async ({ input }) => {
    const { limit, cursor, userId } = input;

    // Status filter for commission-earning quotes
    const earnedStatuses = ['po_confirmed', 'paid', 'delivered'] as const;

    // Build conditions
    const conditions = [
      inArray(quotes.status, earnedStatuses),
      isNull(quotes.commissionPaidOutAt), // Not yet paid out
    ];

    if (userId) {
      conditions.push(eq(quotes.userId, userId));
    }

    // Get pending payout quotes with user info
    const pendingQuotes = await db
      .select({
        quote: {
          id: quotes.id,
          name: quotes.name,
          status: quotes.status,
          totalUsd: quotes.totalUsd,
          quoteData: quotes.quoteData,
          createdAt: quotes.createdAt,
          paidAt: quotes.paidAt,
        },
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          customerType: users.customerType,
        },
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(quotes.paidAt), desc(quotes.createdAt))
      .limit(limit + 1)
      .offset(cursor);

    const hasMore = pendingQuotes.length > limit;

    // Filter to B2C users only and calculate commission
    const data = pendingQuotes
      .slice(0, limit)
      .filter((row) => row.user?.customerType === 'b2c')
      .map((row) => {
        const quoteData = row.quote.quoteData as { totalCommissionUsd?: number } | null;
        return {
          quoteId: row.quote.id,
          quoteName: row.quote.name,
          status: row.quote.status,
          orderTotal: row.quote.totalUsd,
          commissionAmount: quoteData?.totalCommissionUsd ?? 0,
          createdAt: row.quote.createdAt,
          paidAt: row.quote.paidAt,
          user: row.user
            ? {
                id: row.user.id,
                name: row.user.name,
                email: row.user.email,
              }
            : null,
        };
      });

    return {
      data,
      meta: {
        nextCursor: hasMore ? cursor + limit : null,
        hasMore,
      },
    };
  });

export default commissionsGetPending;
