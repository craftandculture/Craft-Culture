import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import getPricingManagerLanded from '@/app/_distribution/data/getPricingManagerLanded';
import wineKey from '@/app/_distribution/utils/wineKey';
import db from '@/database/client';
import {
  cellarPurchaseItems,
  consignmentSettlementItems,
  consignmentSettlements,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

/**
 * Price what a partner is owed once their wine has a landed cost
 *
 * A partner's consignment sold to a cellar member before anyone set its import
 * price is recorded owing nothing and held back from payout. Once the cost is
 * set in the Pricing Manager, this reads it the same way the confirmation
 * would have and releases the debt to the next payout run.
 *
 * Only held debts that no run has taken are touched, and one still without a
 * cost stays held.
 *
 * @example
 *   await trpcClient.consignment.admin.recostPartnerSettlements.mutate({ purchaseId });
 */
const adminRecostPartnerSettlements = staffAdminProcedure
  .input(z.object({ purchaseId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const held = await db
      .select({
        id: consignmentSettlements.id,
        orderNumber: consignmentSettlements.orderNumber,
        saleAmount: consignmentSettlements.saleAmount,
        itemId: consignmentSettlementItems.id,
        lwin18: consignmentSettlementItems.lwin18,
        quantityCases: consignmentSettlementItems.quantityCases,
      })
      .from(consignmentSettlements)
      .innerJoin(
        consignmentSettlementItems,
        eq(consignmentSettlementItems.settlementId, consignmentSettlements.id),
      )
      .where(
        and(
          eq(consignmentSettlements.orderId, input.purchaseId),
          eq(consignmentSettlements.status, 'pending'),
          isNull(consignmentSettlements.payoutRunId),
        ),
      );

    if (held.length === 0) return { priced: 0, stillHeld: 0 };

    const landed = new Map(
      (
        await getPricingManagerLanded([
          ...new Set(held.map((row) => wineKey(row.lwin18))),
        ])
      ).map((row) => [row.key, row.landedPerBottle]),
    );

    /*
      Bottles come from the purchase line, not the settlement's case count,
      which rounds a part case up.
    */
    const lines = await db
      .select({
        lwin18: cellarPurchaseItems.lwin18,
        bottles: cellarPurchaseItems.bottles,
      })
      .from(cellarPurchaseItems)
      .where(eq(cellarPurchaseItems.purchaseId, input.purchaseId));

    let priced = 0;
    const now = new Date();

    for (const row of held) {
      const perBottle = landed.get(wineKey(row.lwin18));
      const bottles = lines.find((line) => line.lwin18 === row.lwin18)?.bottles;

      if (!perBottle || !bottles) continue;

      const owed = Math.round(perBottle * bottles * 100) / 100;
      const commission = Math.round((row.saleAmount - owed) * 100) / 100;

      await db.transaction(async (tx) => {
        await tx
          .update(consignmentSettlements)
          .set({
            owedToOwner: owed,
            commissionAmount: commission,
            commissionPercent:
              row.saleAmount > 0
                ? Math.round((commission / row.saleAmount) * 10000) / 100
                : 0,
            status: 'payment_received',
            invoicePaidAt: now,
            notes: `Cellar purchase ${row.orderNumber} · owed at landed cost $${perBottle.toFixed(2)} a bottle`,
            updatedAt: now,
          })
          .where(
            and(
              eq(consignmentSettlements.id, row.id),
              eq(consignmentSettlements.status, 'pending'),
              isNull(consignmentSettlements.payoutRunId),
            ),
          );

        await tx
          .update(consignmentSettlementItems)
          .set({ unitPrice: perBottle, lineTotal: owed, updatedAt: now })
          .where(eq(consignmentSettlementItems.id, row.itemId));
      });

      priced += 1;
    }

    return { priced, stillHeld: held.length - priced };
  });

export default adminRecostPartnerSettlements;
