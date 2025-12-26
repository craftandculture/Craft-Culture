import { and, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { quotes, users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Get commission summary for the current B2C user
 *
 * Returns aggregate totals for earned, pending payout, and paid out commissions.
 * Commission is earned when quote status is 'po_confirmed' or 'paid'.
 *
 * @example
 *   await trpcClient.commissions.getSummary.query();
 */
const commissionsGetSummary = protectedProcedure.query(async ({ ctx: { user } }) => {
  // Verify user is B2C (only B2C users earn commission)
  const [userData] = await db
    .select({ customerType: users.customerType })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (userData?.customerType !== 'b2c') {
    return {
      totalEarned: 0,
      pendingPayout: 0,
      paidOut: 0,
      isB2C: false,
    };
  }

  // Status filter for commission-earning quotes
  const earnedStatuses = ['po_confirmed', 'paid', 'delivered'] as const;

  // Get all commission-earning quotes for this user
  const commissionQuotes = await db
    .select({
      quoteData: quotes.quoteData,
      commissionPaidOutAt: quotes.commissionPaidOutAt,
    })
    .from(quotes)
    .where(
      and(
        eq(quotes.userId, user.id),
        inArray(quotes.status, earnedStatuses),
      ),
    );

  let totalEarned = 0;
  let pendingPayout = 0;
  let paidOut = 0;

  for (const quote of commissionQuotes) {
    const quoteData = quote.quoteData as { totalCommissionUsd?: number } | null;
    const commission = quoteData?.totalCommissionUsd ?? 0;

    totalEarned += commission;

    if (quote.commissionPaidOutAt) {
      paidOut += commission;
    } else {
      pendingPayout += commission;
    }
  }

  return {
    totalEarned,
    pendingPayout,
    paidOut,
    isB2C: true,
  };
});

export default commissionsGetSummary;
