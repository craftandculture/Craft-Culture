import { TRPCError } from '@trpc/server';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { z } from 'zod';

import assertActivated from '@/app/_onboarding/data/assertActivated';
import db from '@/database/client';
import { cellarSourcingRequests } from '@/database/schema';
import { collectorProcedure } from '@/lib/trpc/procedures';

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
const memberRespondSourcingOffer = collectorProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      response: z.enum(['accept', 'decline']),
      /*
        The figures the member saw. Accepting holds them to exactly that
        offer: if the team has re-sent it at a different price or quantity
        since the page loaded, the accept is refused rather than taken at
        terms the member never saw.
      */
      pricePerBottleUsd: z.number().nonnegative().optional(),
      cases: z.number().int().nonnegative().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (input.response === 'accept') {
      await assertActivated(ctx.partner.id);

      if (input.pricePerBottleUsd === undefined || input.cases === undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Please refresh the page and accept the offer again.',
        });
      }
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
          ...(input.response === 'accept'
            ? [
                eq(
                  cellarSourcingRequests.offerPricePerBottleUsd,
                  input.pricePerBottleUsd!,
                ),
                eq(cellarSourcingRequests.offerCases, input.cases!),
              ]
            : []),
        ),
      )
      .returning();

    if (!row) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'This offer is no longer open, or it has changed since you opened the page. Please refresh to see the latest, or contact us.',
      });
    }

    const wineName = row.offerWineName ?? row.wineName;
    let purchaseNumber: string | null = null;

    if (input.response === 'accept') {
      /*
        If the wine cannot be reserved or handed to the team, the accept is
        undone so the member can try again — never left accepted with nothing
        behind it.
      */
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
      }).catch(async (error: unknown) => {
        await db
          .update(cellarSourcingRequests)
          .set({ status: 'offer_sent', respondedAt: null, updatedAt: new Date() })
          .where(
            and(
              eq(cellarSourcingRequests.id, row.id),
              eq(cellarSourcingRequests.status, 'accepted'),
              isNull(cellarSourcingRequests.purchaseId),
            ),
          );
        throw error;
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
