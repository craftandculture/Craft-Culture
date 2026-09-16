import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNull, lte } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  consignmentPayoutRuns,
  consignmentSettlements,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import generateRunNumber from '../utils/generateRunNumber';

/**
 * Gather what is owed to members into a single run
 *
 * Members are paid monthly, so this is the monthly act: everything a buyer has
 * actually paid for, and which no earlier run has already claimed, is collected
 * into one batch to be approved and then billed.
 *
 * **Only settlements at `payment_received`.** A sale that has happened but has
 * not been paid for is not yet money we hold, and paying it out would have C&C
 * financing its own members — the one thing the model rules out.
 *
 * The run is a draft. Nothing reaches Zoho until it is approved, so the figures
 * can be read and argued with first.
 */
const adminCreatePayoutRun = adminProcedure
  .input(
    z.object({
      /** Sales settled on or before this date are swept in */
      periodEnd: z.string(),
      periodStart: z.string().optional(),
      notes: z.string().max(1000).optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const periodEnd = new Date(input.periodEnd);

    if (Number.isNaN(periodEnd.getTime())) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'That is not a date.',
      });
    }

    /*
      Anything unclaimed, not only what falls inside the window. A settlement
      that missed last month's run because it had not been paid for yet must be
      swept into this one rather than stranded — which is what a strict
      period filter on both ends would do.
    */
    const periodStart = input.periodStart
      ? new Date(input.periodStart)
      : new Date(0);

    const runNumber = await generateRunNumber();

    const result = await db.transaction(async (tx) => {
      const pending = await tx
        .select({
          id: consignmentSettlements.id,
          ownerId: consignmentSettlements.ownerId,
          owedToOwner: consignmentSettlements.owedToOwner,
        })
        .from(consignmentSettlements)
        .where(
          and(
            eq(consignmentSettlements.status, 'payment_received'),
            isNull(consignmentSettlements.payoutRunId),
            lte(consignmentSettlements.invoicePaidAt, periodEnd),
          ),
        );

      if (pending.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Nothing is waiting to be paid. Sales settle here once the buyer has paid for them.',
        });
      }

      const total = pending.reduce(
        (sum, row) => sum + (row.owedToOwner ?? 0),
        0,
      );

      const members = new Set(pending.map((row) => row.ownerId));

      const [run] = await tx
        .insert(consignmentPayoutRuns)
        .values({
          runNumber,
          periodStart,
          periodEnd,
          status: 'draft',
          totalUsd: Math.round(total * 100) / 100,
          memberCount: members.size,
          notes: input.notes,
        })
        .returning({ id: consignmentPayoutRuns.id });

      if (!run) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not open that run',
        });
      }

      /*
        Claimed by id and only while still unclaimed. Two runs opened at once
        would otherwise both sweep the same settlements and pay a member twice.
      */
      await tx
        .update(consignmentSettlements)
        .set({ payoutRunId: run.id, updatedAt: new Date() })
        .where(
          and(
            inArray(
              consignmentSettlements.id,
              pending.map((row) => row.id),
            ),
            isNull(consignmentSettlements.payoutRunId),
          ),
        );

      return {
        id: run.id,
        settlements: pending.length,
        members: members.size,
        total,
      };
    });

    return { runNumber, ...result };
  });

export default adminCreatePayoutRun;
