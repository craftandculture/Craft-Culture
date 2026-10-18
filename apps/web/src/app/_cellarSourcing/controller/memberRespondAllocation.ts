import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import assertActivated from '@/app/_onboarding/data/assertActivated';
import db from '@/database/client';
import {
  cellarAllocationInterests,
  cellarAllocations,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import fulfilAgreedWine from '../data/fulfilAgreedWine';
import notifyAllocationUpdate from '../data/notifyAllocationUpdate';

/**
 * A member confirms or declines the share of an allocation we gave them
 *
 * Claimed with a conditional update, so confirming twice cannot reserve the
 * wine twice. Confirmed wine in our UAE warehouse is reserved at once;
 * anything else, en primeur included, goes to the team to invoice.
 *
 * @example
 *   await trpcClient.cellarSourcing.member.respondAllocation.mutate({ interestId, response: 'confirm' });
 */
const memberRespondAllocation = stockOwnerProcedure
  .input(
    z.object({
      interestId: z.string().uuid(),
      response: z.enum(['confirm', 'decline']),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (input.response === 'confirm') {
      await assertActivated(ctx.partner.id);
    }

    const now = new Date();

    const [interest] = await db
      .update(cellarAllocationInterests)
      .set({
        status: input.response === 'confirm' ? 'confirmed' : 'declined',
        respondedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(cellarAllocationInterests.id, input.interestId),
          eq(cellarAllocationInterests.partnerId, ctx.partner.id),
          eq(cellarAllocationInterests.status, 'allocated'),
        ),
      )
      .returning();

    if (!interest) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'There is nothing waiting for you to confirm here.',
      });
    }

    const [allocation] = await db
      .select()
      .from(cellarAllocations)
      .where(eq(cellarAllocations.id, interest.allocationId))
      .limit(1);

    if (!allocation) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Offer not found' });
    }

    const cases = interest.casesAllocated ?? 0;
    let purchaseNumber: string | null = null;

    if (input.response === 'confirm' && cases > 0) {
      const result = await fulfilAgreedWine({
        partnerId: ctx.partner.id,
        partnerName: ctx.partner.businessName,
        userId: ctx.user.id,
        reference: `${allocation.wineName}${allocation.vintage ? ` ${allocation.vintage}` : ''} allocation`,
        lwin18: allocation.lwin18,
        wineName: allocation.wineName,
        cases,
        caseConfig: allocation.caseConfig,
        pricePerBottleUsd: allocation.pricePerBottleUsd,
        holdAt: allocation.holdAt,
        fromStock: allocation.fromStock,
        linkUrl: '/platform/admin/cellar-members?tab=requests',
      });

      purchaseNumber = result.purchase?.purchaseNumber ?? null;

      await db
        .update(cellarAllocationInterests)
        .set({
          purchaseId: result.purchase?.purchaseId ?? null,
          taskId: result.taskId,
          updatedAt: new Date(),
        })
        .where(eq(cellarAllocationInterests.id, interest.id));
    }

    await notifyAllocationUpdate({
      event: input.response === 'confirm' ? 'confirmed' : 'declined',
      allocationId: allocation.id,
      wineName: allocation.wineName,
      memberName: ctx.partner.businessName,
      cases,
    });

    return { purchaseNumber };
  });

export default memberRespondAllocation;
