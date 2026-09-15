import { eq } from 'drizzle-orm';

import type db from '@/database/client';
import {
  consignmentSettlementItems,
  consignmentSettlements,
  poolSales,
} from '@/database/schema';

import generateSettlementNumber from './generateSettlementNumber';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface WriteSettlementParams {
  tx: Tx;
  /** The sale being settled, already inserted */
  sale: typeof poolSales.$inferSelect;
  /** Set when the buyer has already paid, which for an in-app purchase they have */
  paidAt?: Date | null;
}

/**
 * Turn a sale of a member's wine into a debt we owe them
 *
 * `consignment_settlements` and its items were migrated a long time ago and
 * have never had a row written to them. This is the only thing that writes
 * them, so that every settlement in the system was produced one way and can be
 * explained one way.
 *
 * **The sale and the settlement are deliberately two records.** A sale happens
 * when a buyer takes the wine; the debt is payable only once their money is
 * actually in. Collapsing them would commit C&C to paying consignors for sales
 * that had not been paid for, which is the one thing the model rules out.
 *
 * Amounts are taken from the sale rather than recomputed. The rate that applied
 * depends on who bought and the constants can change; a settlement has to stay
 * explicable years after both.
 *
 * @example
 *   await db.transaction(async (tx) => {
 *     const [sale] = await tx.insert(poolSales).values({...}).returning();
 *     await writeConsignmentSettlement({ tx, sale, paidAt: new Date() });
 *   });
 *
 * @param params - The transaction, the sale, and whether it is already paid
 * @returns The settlement id and number
 */
const writeConsignmentSettlement = async ({
  tx,
  sale,
  paidAt = null,
}: WriteSettlementParams) => {
  const settlementNumber = await generateSettlementNumber();

  const [settlement] = await tx
    .insert(consignmentSettlements)
    .values({
      settlementNumber,
      /*
        The sale stands in for the order. These columns are NOT NULL and were
        written for a world where every settlement came from a sales order;
        a distributor's monthly report has no order in our system at all.
      */
      orderId: sale.id,
      orderNumber: sale.saleNumber,
      ownerId: sale.ownerId,
      ownerName: sale.ownerName,
      saleAmount: sale.saleTotalUsd,
      commissionPercent: sale.commissionPct,
      commissionAmount: sale.commissionUsd,
      owedToOwner: sale.owedToOwnerUsd,
      currency: 'USD',
      /*
        payment_received, not settled. Settled means the member has the money,
        which happens on a payout run and not before.
      */
      status: paidAt ? 'payment_received' : 'pending',
      invoicePaidAt: paidAt,
      source: sale.source,
    })
    .returning({
      id: consignmentSettlements.id,
      settlementNumber: consignmentSettlements.settlementNumber,
    });

  if (!settlement) throw new Error('Could not write the settlement');

  await tx.insert(consignmentSettlementItems).values({
    settlementId: settlement.id,
    lwin18: sale.lwin18,
    productName: sale.productName,
    /*
      Cases, because that is what the column has always meant. A part-case sale
      rounds up to the case it came out of, which is also what was physically
      opened.
    */
    quantityCases: Math.max(
      1,
      Math.ceil(sale.bottles / Math.max(1, sale.caseConfig ?? 1)),
    ),
    unitPrice: sale.askPerBottleUsd,
    lineTotal: sale.owedToOwnerUsd,
    stockId: sale.stockId,
  });

  await tx
    .update(poolSales)
    .set({ settlementId: settlement.id, updatedAt: new Date() })
    .where(eq(poolSales.id, sale.id));

  return settlement;
};

export default writeConsignmentSettlement;
