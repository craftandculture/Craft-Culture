import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { quotes, users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

const commissionsGetDetailsSchema = z.object({
  limit: z.number().min(1).max(50).default(20),
  cursor: z.number().min(0).default(0),
});

/**
 * Get detailed list of orders with commission information for the current B2C user
 *
 * @example
 *   await trpcClient.commissions.getDetails.query({ limit: 20, cursor: 0 });
 */
const commissionsGetDetails = protectedProcedure
  .input(commissionsGetDetailsSchema)
  .query(async ({ input, ctx: { user } }) => {
    const { limit, cursor } = input;

    // Verify user is B2C
    const [userData] = await db
      .select({ customerType: users.customerType })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (userData?.customerType !== 'b2c') {
      return {
        data: [],
        meta: { totalCount: 0, nextCursor: null, hasMore: false },
      };
    }

    // Status filter for commission-earning quotes
    const earnedStatuses = ['po_confirmed', 'paid', 'delivered'] as const;

    // Get quotes with commission
    const commissionQuotes = await db
      .select({
        id: quotes.id,
        name: quotes.name,
        status: quotes.status,
        totalUsd: quotes.totalUsd,
        quoteData: quotes.quoteData,
        createdAt: quotes.createdAt,
        paidAt: quotes.paidAt,
        commissionPaidOutAt: quotes.commissionPaidOutAt,
        commissionPayoutReference: quotes.commissionPayoutReference,
        commissionPayoutNotes: quotes.commissionPayoutNotes,
      })
      .from(quotes)
      .where(
        and(
          eq(quotes.userId, user.id),
          inArray(quotes.status, earnedStatuses),
        ),
      )
      .orderBy(desc(quotes.createdAt))
      .limit(limit + 1)
      .offset(cursor);

    const hasMore = commissionQuotes.length > limit;
    const data = commissionQuotes.slice(0, limit).map((quote) => {
      const quoteData = quote.quoteData as { totalCommissionUsd?: number } | null;
      return {
        id: quote.id,
        name: quote.name,
        status: quote.status,
        orderTotal: quote.totalUsd,
        commissionEarned: quoteData?.totalCommissionUsd ?? 0,
        createdAt: quote.createdAt,
        paidAt: quote.paidAt,
        commissionPaidOutAt: quote.commissionPaidOutAt,
        payoutReference: quote.commissionPayoutReference,
        payoutNotes: quote.commissionPayoutNotes,
      };
    });

    return {
      data,
      meta: {
        totalCount: data.length,
        nextCursor: hasMore ? cursor + limit : null,
        hasMore,
      },
    };
  });

export default commissionsGetDetails;
