import { desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  consignmentPayoutRuns,
  consignmentSettlements,
  poolSales,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * What a member's sold wine has earned them, and where the money has got to
 *
 * Every figure is the member's own: their asking price times the bottles sold.
 * The sale price and our commission sit on the same rows and are deliberately
 * not selected, so they cannot reach the browser by accident.
 *
 * A sale passes through three states before the member is paid, and each one
 * is a different answer to "where is my money":
 *
 * - **pending**: sold, but the buyer has not paid us yet
 * - **payment_received**: we hold the money; it goes in the next monthly payment
 * - **settled**: a monthly payment has been issued for it
 *
 * @example
 *   const { awaitingBuyer, nextPayment, payments } =
 *     await trpcClient.consignment.member.getProceeds.query();
 */
const memberGetProceeds = stockOwnerProcedure.query(async ({ ctx }) => {
  const sales = await db
    .select({
      id: poolSales.id,
      productName: poolSales.productName,
      bottles: poolSales.bottles,
      askPerBottleUsd: poolSales.askPerBottleUsd,
      owedToOwnerUsd: poolSales.owedToOwnerUsd,
      soldAt: poolSales.soldAt,
      settlementStatus: consignmentSettlements.status,
      settledAt: consignmentSettlements.settledAt,
      payoutRunId: consignmentSettlements.payoutRunId,
      runStatus: consignmentPayoutRuns.status,
      runPaidAt: consignmentPayoutRuns.paidAt,
      runApprovedAt: consignmentPayoutRuns.approvedAt,
    })
    .from(poolSales)
    .leftJoin(
      consignmentSettlements,
      eq(poolSales.settlementId, consignmentSettlements.id),
    )
    .leftJoin(
      consignmentPayoutRuns,
      eq(consignmentSettlements.payoutRunId, consignmentPayoutRuns.id),
    )
    .where(eq(poolSales.ownerId, ctx.partner.id))
    .orderBy(desc(poolSales.soldAt))
    .limit(500);

  const sale = (row: (typeof sales)[number]) => ({
    id: row.id,
    productName: row.productName,
    bottles: row.bottles,
    askPerBottleUsd: row.askPerBottleUsd,
    amountUsd: row.owedToOwnerUsd,
    soldAt: row.soldAt,
  });

  const sum = (rows: typeof sales) =>
    Math.round(rows.reduce((total, row) => total + row.owedToOwnerUsd, 0) * 100) /
    100;

  /*
    A sale with no settlement yet is treated as awaiting the buyer. Settlements
    are written with the sale, so this is a sale recorded before that existed,
    and it is not money we can promise.
  */
  const awaiting = sales.filter(
    (row) => !row.settlementStatus || row.settlementStatus === 'pending',
  );
  const next = sales.filter((row) => row.settlementStatus === 'payment_received');
  const paid = sales.filter((row) => row.settlementStatus === 'settled');

  /*
    One payment per monthly run. The date is when the run was paid, or when it
    was approved and the payment raised if the paid date was never recorded.
  */
  const byRun = new Map<string, typeof sales>();

  for (const row of paid) {
    const key = row.payoutRunId ?? `settled-${row.settledAt?.toISOString() ?? ''}`;
    byRun.set(key, [...(byRun.get(key) ?? []), row]);
  }

  const payments = [...byRun.entries()]
    .map(([key, rows]) => {
      const first = rows[0];

      return {
        id: key,
        paidAt: first?.runPaidAt ?? first?.runApprovedAt ?? first?.settledAt ?? null,
        amountUsd: sum(rows),
        bottles: rows.reduce((total, row) => total + row.bottles, 0),
        sales: rows.map(sale),
      };
    })
    .sort(
      (a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0),
    );

  return {
    awaitingBuyer: {
      amountUsd: sum(awaiting),
      bottles: awaiting.reduce((total, row) => total + row.bottles, 0),
      sales: awaiting.map(sale),
    },
    nextPayment: {
      amountUsd: sum(next),
      bottles: next.reduce((total, row) => total + row.bottles, 0),
      /* Already gathered into a run being prepared, as opposed to waiting for one */
      isBeingPrepared:
        next.length > 0 && next.every((row) => row.payoutRunId !== null),
      sales: next.map(sale),
    },
    payments,
    totalPaidUsd: sum(paid),
  };
});

export default memberGetProceeds;
