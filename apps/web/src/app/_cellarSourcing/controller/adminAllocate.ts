import { TRPCError } from '@trpc/server';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarAllocationInterests,
  cellarAllocations,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import notifyAllocationUpdate from '../data/notifyAllocationUpdate';

/**
 * The team gives a member their share of an allocation
 *
 * Zero tells the member politely that there was not enough to go round. The
 * shares given out can never add up to more than there is: the allocation row
 * is locked while the sum is checked, so two staff allocating at once cannot
 * both use the last case.
 *
 * @example
 *   await trpcClient.cellarSourcing.admin.allocate.mutate({ interestId, cases: 2 });
 */
const adminAllocate = staffAdminProcedure
  .input(
    z.object({
      interestId: z.string().uuid(),
      cases: z.number().int().min(0).max(10_000),
    }),
  )
  .mutation(async ({ input }) => {
    const result = await db.transaction(async (tx) => {
      const [interest] = await tx
        .select()
        .from(cellarAllocationInterests)
        .where(eq(cellarAllocationInterests.id, input.interestId))
        .limit(1);

      if (!interest || !['interested', 'allocated'].includes(interest.status)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'This member has already confirmed, declined or withdrawn their interest.',
        });
      }

      const [allocation] = await tx
        .select()
        .from(cellarAllocations)
        .where(eq(cellarAllocations.id, interest.allocationId))
        .for('update')
        .limit(1);

      if (!allocation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Offer not found' });
      }

      const [given] = await tx
        .select({
          cases: sql<number>`coalesce(sum(${cellarAllocationInterests.casesAllocated}), 0)::int`,
        })
        .from(cellarAllocationInterests)
        .where(
          and(
            eq(cellarAllocationInterests.allocationId, allocation.id),
            ne(cellarAllocationInterests.id, interest.id),
            inArray(cellarAllocationInterests.status, ['allocated', 'confirmed']),
          ),
        );

      const left = allocation.totalCases - (given?.cases ?? 0);

      if (input.cases > left) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Only ${left} ${left === 1 ? 'case is' : 'cases are'} left to allocate.`,
        });
      }

      const [updated] = await tx
        .update(cellarAllocationInterests)
        .set({
          casesAllocated: input.cases,
          status: input.cases === 0 ? 'unallocated' : 'allocated',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(cellarAllocationInterests.id, interest.id),
            inArray(cellarAllocationInterests.status, ['interested', 'allocated']),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This member has just responded. Refresh and try again.',
        });
      }

      return { interest: updated, allocation };
    });

    await notifyAllocationUpdate({
      event: input.cases === 0 ? 'unallocated' : 'allocated',
      allocationId: result.allocation.id,
      wineName: result.allocation.vintage
        ? `${result.allocation.wineName} ${result.allocation.vintage}`
        : result.allocation.wineName,
      partnerId: result.interest.partnerId,
      cases: input.cases,
    });

    return { status: result.interest.status };
  });

export default adminAllocate;
