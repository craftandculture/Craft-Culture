import { and, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { quotes, users } from '@/database/schema';
import { approvedProcedure } from '@/lib/trpc/procedures';

import computeQuoteCommissions from '../utils/computeQuoteCommissions';

/**
 * Get commission summary for the current B2C user
 *
 * Returns aggregate totals for earned, pending payout, and paid out commissions.
 * Commission is earned when quote status is 'po_confirmed' or 'paid'.
 *
 * @example
 *   await trpcClient.commissions.getSummary.query();
 */
const commissionsGetSummary = approvedProcedure.query(async ({ ctx: { user } }) => {
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
      id: quotes.id,
      lineItems: quotes.lineItems,
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

  // Worked out on the server, not the figure each quote was saved with
  const commissions = await computeQuoteCommissions(commissionQuotes);

  for (const quote of commissionQuotes) {
    const commission = commissions.get(quote.id)?.commissionUsd ?? 0;

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
