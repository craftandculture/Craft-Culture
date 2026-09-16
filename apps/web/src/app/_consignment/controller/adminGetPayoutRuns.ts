import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  consignmentPayoutRuns,
  consignmentSettlements,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Payout runs, and what is waiting for the next one
 *
 * The waiting figure is the one that matters day to day: it is money we are
 * holding on members' behalf and have not yet paid over, so it should be
 * visible without opening anything.
 */
const adminGetPayoutRuns = adminProcedure.query(async () => {
  const runs = await db
    .select()
    .from(consignmentPayoutRuns)
    .orderBy(desc(consignmentPayoutRuns.createdAt))
    .limit(50);

  const [waiting] = await db
    .select({
      settlements: sql<number>`count(*)`,
      owed: sql<number>`coalesce(sum(${consignmentSettlements.owedToOwner}), 0)`,
      members: sql<number>`count(distinct ${consignmentSettlements.ownerId})`,
    })
    .from(consignmentSettlements)
    .where(
      and(
        eq(consignmentSettlements.status, 'payment_received'),
        isNull(consignmentSettlements.payoutRunId),
      ),
    );

  if (runs.length === 0) {
    return {
      runs: [],
      waiting: {
        settlements: Number(waiting?.settlements ?? 0),
        owedUsd: Number(waiting?.owed ?? 0),
        members: Number(waiting?.members ?? 0),
      },
    };
  }

  const lines = await db
    .select({
      payoutRunId: consignmentSettlements.payoutRunId,
      settlementNumber: consignmentSettlements.settlementNumber,
      ownerName: consignmentSettlements.ownerName,
      owedToOwner: consignmentSettlements.owedToOwner,
      status: consignmentSettlements.status,
      zohoBillId: consignmentSettlements.zohoBillId,
    })
    .from(consignmentSettlements)
    .where(
      inArray(
        consignmentSettlements.payoutRunId,
        runs.map((run) => run.id),
      ),
    );

  const byRun = new Map<string, typeof lines>();

  for (const line of lines) {
    if (!line.payoutRunId) continue;

    byRun.set(line.payoutRunId, [
      ...(byRun.get(line.payoutRunId) ?? []),
      line,
    ]);
  }

  return {
    runs: runs.map((run) => ({
      ...run,
      settlements: byRun.get(run.id) ?? [],
      /*
        Bills raised out of bills expected. A run can be approved while Zoho is
        unreachable, and without this the difference is invisible.
      */
      billed: (byRun.get(run.id) ?? []).filter((line) => line.zohoBillId).length,
    })),
    waiting: {
      settlements: Number(waiting?.settlements ?? 0),
      owedUsd: Number(waiting?.owed ?? 0),
      members: Number(waiting?.members ?? 0),
    },
  };
});

export default adminGetPayoutRuns;
