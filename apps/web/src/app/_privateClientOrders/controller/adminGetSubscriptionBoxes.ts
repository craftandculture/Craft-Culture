import { and, count, isNotNull, ne, sql } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/**
 * Every subscription box that has been used, with how many live orders carry it
 *
 * Feeds the order list's Box filter and the variant dropdown, so a variant
 * typed once ("Red only") is offered from then on without a settings screen.
 * Cancelled orders are left out of the count, since they are not boxes that
 * will ship.
 */
const adminGetSubscriptionBoxes = wmsOperatorProcedure.query(async () => {
  const rows = await db
    .select({
      tier: privateClientOrders.subscriptionTier,
      caseSize: privateClientOrders.subscriptionCaseSize,
      variant: privateClientOrders.subscriptionVariant,
      orders: count(),
    })
    .from(privateClientOrders)
    .where(
      and(
        isNotNull(privateClientOrders.subscriptionTier),
        ne(privateClientOrders.status, 'cancelled'),
      ),
    )
    .groupBy(
      privateClientOrders.subscriptionTier,
      privateClientOrders.subscriptionCaseSize,
      privateClientOrders.subscriptionVariant,
    )
    .orderBy(
      privateClientOrders.subscriptionTier,
      privateClientOrders.subscriptionCaseSize,
      sql`${privateClientOrders.subscriptionVariant} NULLS FIRST`,
    );

  return rows.map((row) => ({
    tier: row.tier!,
    caseSize: row.caseSize,
    variant: row.variant,
    orders: Number(row.orders),
  }));
});

export default adminGetSubscriptionBoxes;
