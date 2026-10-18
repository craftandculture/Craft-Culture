import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarPurchaseItems,
  cellarPurchases,
  consignmentSettlementItems,
  consignmentSettlements,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import describeLineSellers from '../data/describeLineSellers';

/**
 * Purchases waiting on us
 *
 * The queue that matters is `payment_claimed` — a member says the money is
 * sent and nothing moves until somebody checks the bank and confirms it.
 */
const adminGetPurchases = staffAdminProcedure
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

    const sellers = await describeLineSellers(items);

    /*
      Partner debts written when a purchase was confirmed. One without a landed
      cost is held at nothing until somebody sets it, so it is flagged on the
      line rather than left to look settled.
    */
    const debts = await db
      .select({
        orderId: consignmentSettlements.orderId,
        stockId: consignmentSettlementItems.stockId,
        status: consignmentSettlements.status,
        owedToOwner: consignmentSettlements.owedToOwner,
      })
      .from(consignmentSettlements)
      .innerJoin(
        consignmentSettlementItems,
        eq(consignmentSettlementItems.settlementId, consignmentSettlements.id),
      )
      .where(
        inArray(
          consignmentSettlements.orderId,
          purchases.map((purchase) => purchase.id),
        ),
      );

    const debtOf = (purchaseId: string, stockId: string) =>
      debts.find((debt) => debt.orderId === purchaseId && debt.stockId === stockId);

    const byPurchase = new Map<
      string,
      ((typeof items)[number] & {
        settlesTo: string;
        settlesToPartner: boolean;
        owedToPartnerUsd: number | null;
        costToConfirm: boolean;
      })[]
    >();

    for (const item of items) {
      const seller = sellers.get(item.id);
      const debt = debtOf(item.purchaseId, item.stockId);

      byPurchase.set(item.purchaseId, [
        ...(byPurchase.get(item.purchaseId) ?? []),
        {
          ...item,
          settlesTo: seller?.label ?? 'C&C',
          settlesToPartner: seller?.kind === 'partner',
          owedToPartnerUsd:
            debt && debt.status !== 'pending' ? debt.owedToOwner : null,
          costToConfirm: !!debt && debt.status === 'pending',
        },
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
        /* Confirming this writes a debt to a partner at landed cost */
        settlesToPartners: (byPurchase.get(purchase.id) ?? []).some(
          (item) => item.settlesToPartner,
        ),
      })),
    };
  });

export default adminGetPurchases;
