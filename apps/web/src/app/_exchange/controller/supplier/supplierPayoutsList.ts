import { and, desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { exchangeOrderItems, supplierPayouts } from '@/database/schema';
import { supplierProcedure } from '@/lib/trpc/procedures';

import { supplierPayoutsListSchema } from '../../schemas/payoutSchema';

/**
 * Get supplier payouts list
 *
 * Returns paginated list of payout records showing settlement history
 * and pending amounts.
 *
 * @example
 *   const payouts = await api.exchange.supplier.payoutsList.query({
 *     page: 1,
 *     status: 'pending',
 *   });
 */
const supplierPayoutsList = supplierProcedure
  .input(supplierPayoutsListSchema)
  .query(async ({ ctx, input }) => {
    const { partnerId } = ctx;
    const { page, limit, status } = input;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(supplierPayouts.supplierId, partnerId)];
    if (status) {
      conditions.push(eq(supplierPayouts.status, status));
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(supplierPayouts)
      .where(and(...conditions));

    const total = countResult?.count ?? 0;

    // Get payouts with item counts
    const payouts = await db
      .select({
        id: supplierPayouts.id,
        periodStart: supplierPayouts.periodStart,
        periodEnd: supplierPayouts.periodEnd,
        amount: supplierPayouts.amount,
        currency: supplierPayouts.currency,
        status: supplierPayouts.status,
        paidAt: supplierPayouts.paidAt,
        transactionReference: supplierPayouts.transactionReference,
        notes: supplierPayouts.notes,
        createdAt: supplierPayouts.createdAt,
        itemCount: sql<number>`(
          select count(*) from ${exchangeOrderItems}
          where ${exchangeOrderItems.payoutId} = ${supplierPayouts.id}
        )::int`,
      })
      .from(supplierPayouts)
      .where(and(...conditions))
      .orderBy(desc(supplierPayouts.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items: payouts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

export default supplierPayoutsList;
