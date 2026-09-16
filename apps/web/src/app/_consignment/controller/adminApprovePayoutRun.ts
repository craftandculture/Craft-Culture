import { tasks } from '@trigger.dev/sdk';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  consignmentPayoutRuns,
  consignmentSettlements,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { zohoCreateBillJob } from '@/trigger/jobs/zoho-sync';

/**
 * Approve a run, and raise the bills that pay it
 *
 * This is where a member is actually paid. Each settlement becomes a bill in
 * Zoho against that member as a vendor, which is what the accounts team then
 * pays — `zohoCreateBillJob` has existed for a long time and until now nothing
 * ever called it.
 *
 * Settlements move to `settled` here and not before. Pending means the buyer
 * has not paid, payment_received means we hold the money, and settled means the
 * member is being paid for it — three different facts that were collapsing into
 * one before there was a run to separate them.
 *
 * The bills are fired and not awaited. A run of forty members would otherwise
 * hold a request open against Zoho's rate limits, and the job is idempotent on
 * `zohoBillId`, so a retry cannot double-bill.
 */
const adminApprovePayoutRun = adminProcedure
  .input(z.object({ runId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [run] = await db
      .select()
      .from(consignmentPayoutRuns)
      .where(eq(consignmentPayoutRuns.id, input.runId))
      .limit(1);

    if (!run) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Run not found' });
    }

    if (run.status !== 'draft') {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `This run is already ${run.status}.`,
      });
    }

    const settlements = await db
      .select({
        id: consignmentSettlements.id,
        ownerName: consignmentSettlements.ownerName,
      })
      .from(consignmentSettlements)
      .where(
        and(
          eq(consignmentSettlements.payoutRunId, run.id),
          eq(consignmentSettlements.status, 'payment_received'),
        ),
      );

    if (settlements.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This run has nothing left to pay.',
      });
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(consignmentSettlements)
        .set({ status: 'settled', settledAt: now, settledBy: ctx.user.id })
        .where(
          and(
            eq(consignmentSettlements.payoutRunId, run.id),
            eq(consignmentSettlements.status, 'payment_received'),
          ),
        );

      await tx
        .update(consignmentPayoutRuns)
        .set({
          status: 'approved',
          approvedAt: now,
          approvedBy: ctx.user.id,
          updatedAt: now,
        })
        .where(eq(consignmentPayoutRuns.id, run.id));
    });

    for (const settlement of settlements) {
      tasks
        .trigger(zohoCreateBillJob.id, { settlementId: settlement.id })
        .catch((error) =>
          console.error('Could not raise a consignment bill', {
            settlementId: settlement.id,
            ownerName: settlement.ownerName,
            error,
          }),
        );
    }

    return {
      runNumber: run.runNumber,
      billed: settlements.length,
    };
  });

export default adminApprovePayoutRun;
