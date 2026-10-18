import { TRPCError } from '@trpc/server';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { z } from 'zod';

import assertActivated from '@/app/_onboarding/data/assertActivated';
import db from '@/database/client';
import { cellarSourcingRequests } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import fulfilAgreedWine from '../data/fulfilAgreedWine';
import notifySourcingUpdate from '../data/notifySourcingUpdate';

/**
 * A member accepts or declines a wine we found for them
 *
 * Accepting is claimed with a conditional update first, so a double click
 * cannot reserve the wine twice. Wine in our UAE warehouse is then reserved at
 * the offered price and appears in Purchases with how to pay; anything else
 * goes to the team to buy, and we invoice by hand.
 *
 * @example
 *   await trpcClient.cellarSourcing.member.respondOffer.mutate({ requestId, response: 'accept' });
 */
const memberRespondSourcingOffer = stockOwnerProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      response: z.enum(['accept', 'decline']),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (input.response === 'accept') {
      await assertActivated(ctx.partner.id);
    }

    const now = new Date();

    const [row] = await db
      .update(cellarSourcingRequests)
      .set({
        status: input.response === 'accept' ? 'accepted' : 'declined',
        respondedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(cellarSourcingRequests.id, input.requestId),
          eq(cellarSourcingRequests.partnerId, ctx.partner.id),
          eq(cellarSourcingRequests.status, 'offer_sent'),
          or(
            isNull(cellarSourcingRequests.offerValidUntil),
            gt(cellarSourcingRequests.offerValidUntil, now),
          ),
        ),
      )
      .returning();

    if (!row) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'This offer is no longer open. Please contact us and we will see what we can do.',
      });
    }

    const wineName = row.offerWineName ?? row.wineName;
    let purchaseNumber: string | null = null;

    if (input.response === 'accept') {
      const result = await fulfilAgreedWine({
        partnerId: ctx.partner.id,
        partnerName: ctx.partner.businessName,
        userId: ctx.user.id,
        reference: row.requestNumber,
        lwin18: row.offerLwin18,
        wineName,
        cases: row.offerCases ?? 0,
        caseConfig: row.offerCaseConfig ?? 1,
        pricePerBottleUsd: row.offerPricePerBottleUsd ?? 0,
        holdAt: row.offerHoldAt ?? row.holdAt,
        fromStock: row.offerFromStock,
        linkUrl: '/platform/admin/cellar-members?tab=requests',
      });

      purchaseNumber = result.purchase?.purchaseNumber ?? null;

      await db
        .update(cellarSourcingRequests)
        .set({
          purchaseId: result.purchase?.purchaseId ?? null,
          taskId: result.taskId,
          updatedAt: new Date(),
        })
        .where(eq(cellarSourcingRequests.id, row.id));
    }

    await notifySourcingUpdate({
      event: input.response === 'accept' ? 'accepted' : 'declined',
      requestId: row.id,
      requestNumber: row.requestNumber,
      partnerId: ctx.partner.id,
      memberName: ctx.partner.businessName,
      wineName,
    });

    return { requestNumber: row.requestNumber, purchaseNumber };
  });

export default memberRespondSourcingOffer;
