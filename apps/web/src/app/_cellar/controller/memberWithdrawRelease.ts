import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarReleaseRequests } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * Withdraw a release request
 *
 * A member who changed their mind had no way to say so, so the request sat in
 * our queue until somebody priced wine nobody wanted. Allowed right up until
 * they accept a quote, because until then nothing has been committed on
 * either side.
 *
 * Cancelled rather than deleted. The request is a record of something the
 * member asked for, and a cellar that quietly forgets its own history is a
 * cellar nobody can audit.
 */
const memberWithdrawRelease = stockOwnerProcedure
  .input(z.object({ requestId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [request] = await db
      .select({
        id: cellarReleaseRequests.id,
        status: cellarReleaseRequests.status,
        requestNumber: cellarReleaseRequests.requestNumber,
      })
      .from(cellarReleaseRequests)
      .where(
        and(
          eq(cellarReleaseRequests.id, input.requestId),
          eq(cellarReleaseRequests.partnerId, ctx.partner.id),
        ),
      )
      .limit(1);

    if (!request) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
    }

    if (request.status === 'confirmed') {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'This one is already being fulfilled. Speak to us and we will sort it out.',
      });
    }

    await db
      .update(cellarReleaseRequests)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(cellarReleaseRequests.id, request.id));

    return { requestNumber: request.requestNumber };
  });

export default memberWithdrawRelease;
