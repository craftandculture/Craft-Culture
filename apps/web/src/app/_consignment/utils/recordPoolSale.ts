import { and, eq, sql } from 'drizzle-orm';

import type db from '@/database/client';
import { poolSales, saleMandateLots, saleMandates } from '@/database/schema';

import generateSaleNumber from './generateSaleNumber';
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
    .limit(1);

  if (!mandate) throw new Error('That mandate does not exist');

  if (bottles <= 0) throw new Error('A sale needs at least one bottle');

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

  const saleNumber = await generateSaleNumber();

  const [sale] = await tx
    .insert(poolSales)
    .values({
      saleNumber,
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

  const remaining = mandate.bottlesRemaining - bottles;

  await tx
    .update(saleMandates)
    .set({
      bottlesRemaining: remaining,
      /*
        Sold closes the mandate; partially_sold keeps it live so the rest stays
        on the lists. Both still count as committing bottles, which is what
        stops the remainder being offered twice.
      */
      status: remaining === 0 ? 'sold' : 'partially_sold',
      updatedAt: new Date(),
    })
    .where(eq(saleMandates.id, mandateId));

  const settlement = await writeConsignmentSettlement({
    tx,
    sale,
    paidAt: paid ? new Date() : null,
  });

  return { sale, settlement };
};

export default recordPoolSale;
