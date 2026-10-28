import { and, eq, inArray, sql } from 'drizzle-orm';

import withNumberRetry from '@/app/_cellar/utils/withNumberRetry';
import type db from '@/database/client';
import { poolSales, saleMandateLots, saleMandates } from '@/database/schema';


import generateSaleNumber from './generateSaleNumber';
import { SELLABLE_STATUSES } from './mandateStatuses';
import writeConsignmentSettlement from './writeConsignmentSettlement';
import type { CommissionAudience } from '../constants/commissionRates';
import { commissionPctFor } from '../constants/commissionRates';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RecordPoolSaleParams {
  tx: Tx;
  mandateId: string;
  /** Which parcel sold, where it is known */
  mandateLotId?: string | null;
  stockId?: string | null;
  bottles: number;
  /** What the buyer actually paid per bottle */
  salePricePerBottleUsd: number;
  buyerAudience: CommissionAudience;
  buyerPartnerId?: string | null;
  buyerName?: string | null;
  source?: 'in_app' | 'distributor' | 'manual';
  /** True when the money is already in, as it is for an in-app purchase */
  paid?: boolean;
  recordedBy?: string | null;
  notes?: string | null;
}

/**
 * Record that a member's wine has sold, and what we now owe them
 *
 * One place, so that a sale made in the platform and a line read off a
 * distributor's monthly report produce the same records with the same
 * arithmetic. The triangulation module exists because those two were previously
 * reconciled by hand in five spreadsheets.
 *
 * **The member receives their ask, not a share of the sale.** Commission is
 * what is left over, which means a sale above the ask earns C&C more and a sale
 * below it — which the catalogue price floor is there to prevent — would earn
 * less than the headline rate. The rate is resolved from the buyer here and
 * frozen onto the sale, because it cannot be known when the mandate is made.
 *
 * Decrements the mandate's remaining bottles and closes it when they run out.
 *
 * @param params - The sale being recorded
 * @returns The sale row and its settlement
 */
const recordPoolSale = async ({
  tx,
  mandateId,
  mandateLotId = null,
  stockId = null,
  bottles,
  salePricePerBottleUsd,
  buyerAudience,
  buyerPartnerId = null,
  buyerName = null,
  source = 'in_app',
  paid = false,
  recordedBy = null,
  notes = null,
}: RecordPoolSaleParams) => {
  const [mandate] = await tx
    .select()
    .from(saleMandates)
    .where(eq(saleMandates.id, mandateId))
    // Locked so two sales of the same wine are counted one after the other
    .for('update')
    .limit(1);

  if (!mandate) throw new Error('That mandate does not exist');

  if (bottles <= 0) throw new Error('A sale needs at least one bottle');

  /*
    Only a live offer can sell. A withdrawn, expired or suspended mandate is
    the member saying no, and the CASE below would otherwise flip it back to
    partially_sold and put the rest of their wine on sale again.
  */
  if (
    !SELLABLE_STATUSES.includes(
      mandate.status as (typeof SELLABLE_STATUSES)[number],
    )
  ) {
    throw new Error(
      `${mandate.mandateNumber} is ${mandate.status} and no longer for sale, so no sale can be recorded against it`,
    );
  }

  if (bottles > mandate.bottlesRemaining) {
    throw new Error(
      `Only ${mandate.bottlesRemaining} bottles remain on ${mandate.mandateNumber}`,
    );
  }

  const commissionPct = commissionPctFor(
    buyerAudience,
    mandate.commissionPctOverride,
  );

  const saleTotalUsd =
    Math.round(salePricePerBottleUsd * bottles * 100) / 100;

  /*
    What the member gets is their ask times the bottles — not a percentage of
    what the buyer paid. Commission is the remainder, so it is computed from the
    two figures rather than applied to one of them.
  */
  const owedToOwnerUsd =
    Math.round(mandate.askPerBottleUsd * bottles * 100) / 100;

  const commissionUsd = Math.round((saleTotalUsd - owedToOwnerUsd) * 100) / 100;

  const sale = await withNumberRetry((attempt) =>
    tx.transaction(async (savepoint) => {
      const [row] = await savepoint
        .insert(poolSales)
        .values({
          saleNumber: await generateSaleNumber(savepoint, attempt),
          mandateId,
          mandateLotId,
          stockId,
          ownerId: mandate.ownerId,
          ownerName: mandate.ownerName,
          buyerPartnerId,
          buyerName,
          buyerAudience,
          lwin18: mandate.lwin18,
          productName: mandate.productName,
          bottles,
          caseConfig: mandate.caseConfig,
          salePricePerBottleUsd,
          saleTotalUsd,
          askPerBottleUsd: mandate.askPerBottleUsd,
          owedToOwnerUsd,
          commissionPct,
          commissionUsd,
          source,
          recordedBy,
          notes,
        })
        .returning();

      return row;
    }),
  );

  if (!sale) throw new Error('Could not record the sale');

  if (mandateLotId) {
    await tx
      .update(saleMandateLots)
      .set({
        bottlesRemaining: sql`GREATEST(0, ${saleMandateLots.bottlesRemaining} - ${bottles})`,
      })
      .where(
        and(
          eq(saleMandateLots.id, mandateLotId),
          eq(saleMandateLots.mandateId, mandateId),
        ),
      );
  }

  /*
    Relative, and only while enough remain. Writing the remaining count read
    earlier let two sales of the same wine both pass the check and both write
    "remaining minus mine", so the wine sold twice and the count went wrong.
  */
  const [decremented] = await tx
    .update(saleMandates)
    .set({
      bottlesRemaining: sql`${saleMandates.bottlesRemaining} - ${bottles}`,
      /*
        Sold closes the mandate; partially_sold keeps it live so the rest stays
        on the lists. Both still count as committing bottles, which is what
        stops the remainder being offered twice.
      */
      status: sql`CASE WHEN ${saleMandates.bottlesRemaining} - ${bottles} = 0 THEN 'sold' ELSE 'partially_sold' END::sale_mandate_status`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(saleMandates.id, mandateId),
        inArray(saleMandates.status, [...SELLABLE_STATUSES]),
        sql`${saleMandates.bottlesRemaining} >= ${bottles}`,
      ),
    )
    .returning({ bottlesRemaining: saleMandates.bottlesRemaining });

  if (!decremented) {
    throw new Error(
      `Fewer than ${bottles} bottles remain on ${mandate.mandateNumber}`,
    );
  }

  const settlement = await writeConsignmentSettlement({
    tx,
    sale,
    paidAt: paid ? new Date() : null,
  });

  return { sale, settlement };
};

export default recordPoolSale;
