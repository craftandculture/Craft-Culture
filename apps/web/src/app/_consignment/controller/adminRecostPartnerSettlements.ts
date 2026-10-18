import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import getOwnerLandedPerBottle from '@/app/_distribution/data/getOwnerLandedPerBottle';
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
        ownerId: consignmentSettlements.ownerId,
        saleAmount: consignmentSettlements.saleAmount,
        itemId: consignmentSettlementItems.id,
        lwin18: consignmentSettlementItems.lwin18,
        quantityCases: consignmentSettlementItems.quantityCases,
        stockId: consignmentSettlementItems.stockId,
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

    /* Each partner's own figure, chosen the way their statement chooses it */
    const owners = [...new Set(held.map((row) => row.ownerId))];
    const landedByOwner = new Map(
      await Promise.all(
        owners.map(
          async (ownerId) =>
            [
              ownerId,
              await getOwnerLandedPerBottle(ownerId, [
                ...new Set(
                  held
                    .filter((row) => row.ownerId === ownerId)
                    .map((row) => wineKey(row.lwin18)),
                ),
              ]),
            ] as const,
        ),
      ),
    );

    /*
      Bottles come from the purchase line, not the settlement's case count,
      which rounds a part case up.
    */
    const lines = await db
      .select({
        stockId: cellarPurchaseItems.stockId,
        lwin18: cellarPurchaseItems.lwin18,
        bottles: cellarPurchaseItems.bottles,
      })
      .from(cellarPurchaseItems)
      .where(eq(cellarPurchaseItems.purchaseId, input.purchaseId));

    let priced = 0;
    const now = new Date();

    for (const row of held) {
      const perBottle = landedByOwner.get(row.ownerId)?.get(wineKey(row.lwin18));
      /*
        Matched on the stock line the debt was written for. Two lines of one
        wine in a purchase, from different parcels, would otherwise both take
        the first line's bottle count.
      */
      const bottles = (
        lines.find((line) => row.stockId && line.stockId === row.stockId) ??
        lines.find((line) => line.lwin18 === row.lwin18)
      )?.bottles;

      if (!perBottle || !bottles) continue;

      const owed = Math.round(perBottle * bottles * 100) / 100;
      const commission = Math.round((row.saleAmount - owed) * 100) / 100;

      const updated = await db.transaction(async (tx) => {
        const [settled] = await tx
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
          )
          .returning({ id: consignmentSettlements.id });

        /* A run took it, or another recheck priced it, while this one ran */
        if (!settled) return false;

        await tx
          .update(consignmentSettlementItems)
          .set({ unitPrice: perBottle, lineTotal: owed, updatedAt: now })
          .where(eq(consignmentSettlementItems.id, row.itemId));

        return true;
      });

      if (updated) priced += 1;
    }

    return { priced, stillHeld: held.length - priced };
  });

export default adminRecostPartnerSettlements;
