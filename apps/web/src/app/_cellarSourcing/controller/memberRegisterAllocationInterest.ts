import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarAllocationInterests,
  cellarAllocations,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import notifyAllocationUpdate from '../data/notifyAllocationUpdate';

/**
 * A member says how much of an allocation they would like
 *
 * Interest commits nobody: the team shares out what there is, and each member
 * confirms their share afterwards. So this is not gated on activation. Zero
 * cases withdraws the interest. Once the team has allocated, the figure is
 * theirs to change, not the member's.
 *
 * @example
 *   await trpcClient.cellarSourcing.member.registerInterest.mutate({ allocationId, cases: 2 });
 */
const memberRegisterAllocationInterest = stockOwnerProcedure
  .input(
    z.object({
      allocationId: z.string().uuid(),
      cases: z.number().int().min(0).max(500),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const now = new Date();

    const [allocation] = await db
      .select()
      .from(cellarAllocations)
      .where(eq(cellarAllocations.id, input.allocationId))
      .limit(1);

    if (
      !allocation ||
      allocation.status !== 'open' ||
      (allocation.closesAt !== null && allocation.closesAt <= now)
    ) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This offer has closed.',
      });
    }

    const cap = Math.min(
      allocation.totalCases,
      allocation.maxCasesPerMember ?? allocation.totalCases,
    );

    if (input.cases > cap) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `You can ask for up to ${cap} ${cap === 1 ? 'case' : 'cases'}.`,
      });
    }

    const [existing] = await db
      .select()
      .from(cellarAllocationInterests)
      .where(
        and(
          eq(cellarAllocationInterests.allocationId, allocation.id),
          eq(cellarAllocationInterests.partnerId, ctx.partner.id),
        ),
      )
      .limit(1);

    const status = input.cases === 0 ? 'withdrawn' : 'interested';

    if (existing) {
      const [updated] = await db
        .update(cellarAllocationInterests)
        .set({
          casesRequested: input.cases === 0 ? existing.casesRequested : input.cases,
          status,
          updatedAt: now,
        })
        .where(
          and(
            eq(cellarAllocationInterests.id, existing.id),
            inArray(cellarAllocationInterests.status, ['interested', 'withdrawn']),
          ),
        )
        .returning({ id: cellarAllocationInterests.id });

      if (!updated) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'We have already shared out this wine. Please contact us if you would like to change your allocation.',
        });
      }
    } else if (input.cases > 0) {
      await db
        .insert(cellarAllocationInterests)
        .values({
          allocationId: allocation.id,
          partnerId: ctx.partner.id,
          casesRequested: input.cases,
          status,
        })
        .onConflictDoNothing();
    }

    if (input.cases > 0) {
      await notifyAllocationUpdate({
        event: 'interest',
        allocationId: allocation.id,
        wineName: allocation.wineName,
        memberName: ctx.partner.businessName,
        cases: input.cases,
      });
    }

    return { status };
  });

export default memberRegisterAllocationInterest;
