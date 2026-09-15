import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarPurchaseItems, cellarPurchases } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Purchases waiting on us
 *
 * The queue that matters is `payment_claimed` — a member says the money is
 * sent and nothing moves until somebody checks the bank and confirms it.
 */
const adminGetPurchases = adminProcedure
  .input(
    z
      .object({
        status: z
          .enum(['open', 'all', 'payment_claimed', 'reserved', 'completed'])
          .default('open'),
      })
      .optional(),
  )
  .query(async ({ input }) => {
    const status = input?.status ?? 'open';

    const purchases = await db
      .select()
      .from(cellarPurchases)
      .where(
        status === 'all'
          ? undefined
          : status === 'open'
            ? inArray(cellarPurchases.status, ['reserved', 'payment_claimed'])
            : eq(cellarPurchases.status, status),
      )
      .orderBy(desc(cellarPurchases.createdAt))
      .limit(200);

    if (purchases.length === 0) return { purchases: [] };

    const items = await db
      .select()
      .from(cellarPurchaseItems)
      .where(
        inArray(
          cellarPurchaseItems.purchaseId,
          purchases.map((purchase) => purchase.id),
        ),
      );

    const byPurchase = new Map<string, typeof items>();

    for (const item of items) {
      byPurchase.set(item.purchaseId, [
        ...(byPurchase.get(item.purchaseId) ?? []),
        item,
      ]);
    }

    return {
      purchases: purchases.map((purchase) => ({
        ...purchase,
        items: byPurchase.get(purchase.id) ?? [],
        /*
          Whether any line settles back to a member. Worth knowing before
          confirming: those are the ones that create a debt.
        */
        settlesToMembers: (byPurchase.get(purchase.id) ?? []).some(
          (item) => item.mandateId,
        ),
      })),
    };
  });

export default adminGetPurchases;
