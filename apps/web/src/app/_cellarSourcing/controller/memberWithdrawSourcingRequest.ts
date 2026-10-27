import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarSourcingRequests } from '@/database/schema';
import { collectorProcedure } from '@/lib/trpc/procedures';

import notifySourcingUpdate from '../data/notifySourcingUpdate';

/**
 * A member no longer needs a wine they asked us to find
 *
 * Only while it is still open. Once they have accepted an offer, the wine is
 * being bought for them and withdrawing is a conversation, not a button.
 *
 * @example
 *   await trpcClient.cellarSourcing.member.withdrawRequest.mutate({ requestId });
 */
const memberWithdrawSourcingRequest = collectorProcedure
  .input(z.object({ requestId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [row] = await db
      .update(cellarSourcingRequests)
      .set({ status: 'withdrawn', respondedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(cellarSourcingRequests.id, input.requestId),
          eq(cellarSourcingRequests.partnerId, ctx.partner.id),
          inArray(cellarSourcingRequests.status, [
            'requested',
            'searching',
            'offer_sent',
          ]),
        ),
      )
      .returning({
        id: cellarSourcingRequests.id,
        requestNumber: cellarSourcingRequests.requestNumber,
        wineName: cellarSourcingRequests.wineName,
      });

    if (!row) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This request can no longer be withdrawn. Please contact us.',
      });
    }

    await notifySourcingUpdate({
      event: 'withdrawn',
      requestId: row.id,
      requestNumber: row.requestNumber,
      partnerId: ctx.partner.id,
      memberName: ctx.partner.businessName,
      wineName: row.wineName,
    });

    return { requestNumber: row.requestNumber };
  });

export default memberWithdrawSourcingRequest;
