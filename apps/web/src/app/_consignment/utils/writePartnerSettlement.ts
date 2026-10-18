import type db from '@/database/client';
import {
  consignmentSettlementItems,
  consignmentSettlements,
} from '@/database/schema';

import generateSettlementNumber from './generateSettlementNumber';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Written into the notes of a settlement whose amount is still to be found */
export const COST_TO_CONFIRM = 'Landed cost not set in the Pricing Manager — amount to confirm';

export interface WritePartnerSettlementParams {
  tx: Tx;
  purchase: { id: string; purchaseNumber: string };
  line: {
    stockId: string;
    lwin18: string;
    productName: string;
    cases: number;
    bottles: number;
    lineTotalUsd: number;
  };
  /** The partner whose consignment sold */
  ownerId: string;
  ownerName: string;
  /** Landed cost per bottle from the Pricing Manager, or null when there is none */
  landedPerBottle: number | null;
}

/**
 * Record what C&C owes a partner whose consignment a cellar member bought
 *
 * A member buying off Available now can be served from any stock on our price
 * lists, including a partner's consignment — Philipp Strasky's case of
 * Cervaro, for one. Until this existed such a sale was treated as C&C's own and
 * recorded nothing, so the partner would never have been paid for it.
 *
 * Owed at landed cost (import price plus cost override in the Pricing
 * Manager), the basis the partner statements already use. The member's price
 * less that is C&C's margin.
 *
 * Where no landed cost is set, the settlement is still written so the debt
 * cannot be forgotten, but held as `pending` with nothing owed yet and a note
 * saying so. Payout runs only take settlements marked as paid for, so it
 * cannot be paid out at zero; staff set the figure and release it.
 *
 * Keyed to the purchase, so reversing the purchase finds and removes it.
 *
 * @param params - The transaction, the purchase line and the partner owed
 * @returns The settlement written
 */
const writePartnerSettlement = async ({
  tx,
  purchase,
  line,
  ownerId,
  ownerName,
  landedPerBottle,
}: WritePartnerSettlementParams) => {
  const known = landedPerBottle !== null && landedPerBottle > 0;

  const owed = known
    ? Math.round((landedPerBottle as number) * line.bottles * 100) / 100
    : 0;

  const commission = Math.round((line.lineTotalUsd - owed) * 100) / 100;

  const settlementNumber = await generateSettlementNumber(tx);

  const [settlement] = await tx
    .insert(consignmentSettlements)
    .values({
      settlementNumber,
      orderId: purchase.id,
      orderNumber: purchase.purchaseNumber,
      ownerId,
      ownerName,
      saleAmount: line.lineTotalUsd,
      commissionPercent:
        known && line.lineTotalUsd > 0
          ? Math.round((commission / line.lineTotalUsd) * 10000) / 100
          : 0,
      commissionAmount: known ? commission : 0,
      owedToOwner: owed,
      currency: 'USD',
      /*
        The member's money is in, so a known debt is ready for the next payout.
        An unknown one waits: a run would otherwise pay it at nothing.
      */
      status: known ? 'payment_received' : 'pending',
      invoicePaidAt: known ? new Date() : null,
      source: 'in_app',
      notes: known
        ? `Cellar purchase ${purchase.purchaseNumber} · owed at landed cost $${(landedPerBottle as number).toFixed(2)} a bottle`
        : `Cellar purchase ${purchase.purchaseNumber} · ${COST_TO_CONFIRM}`,
    })
    .returning({
      id: consignmentSettlements.id,
      settlementNumber: consignmentSettlements.settlementNumber,
    });

  if (!settlement) throw new Error('Could not write the settlement');

  await tx.insert(consignmentSettlementItems).values({
    settlementId: settlement.id,
    lwin18: line.lwin18,
    productName: line.productName,
    quantityCases: Math.max(1, line.cases),
    unitPrice: known ? (landedPerBottle as number) : 0,
    lineTotal: owed,
    stockId: line.stockId,
  });

  return { ...settlement, known };
};

export default writePartnerSettlement;
