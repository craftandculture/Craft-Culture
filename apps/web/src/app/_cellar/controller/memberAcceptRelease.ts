import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import assertActivated from '@/app/_onboarding/data/assertActivated';
import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import checkReleaseStock from '../data/checkReleaseStock';
import getMemberZohoCustomer from '../data/getMemberZohoCustomer';
import raiseReleaseOrder from '../data/raiseReleaseOrder';
import notifyReleaseUpdate from '../utils/notifyReleaseUpdate';

/**
 * Accept the quoted cost, and turn the request into an order
 *
 * The member agreeing the number is what makes this real, so the order is
 * raised here rather than by an admin afterwards — the two must not be able to
 * disagree about what was accepted. Staff confirming on the member's behalf go
 * through the same raiseReleaseOrder.
 */
const memberAcceptRelease = stockOwnerProcedure
  .input(z.object({ requestId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    /* A paused membership stops deliveries, the same as it stops buying. */
    await assertActivated(ctx.partner.id);

    const [request] = await db
      .select()
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

    if (request.status !== 'under_review' || request.quotedAt === null) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'There is no quote on this request to accept yet.',
      });
    }

    if (request.privateClientOrderId) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'You have already accepted this delivery.',
      });
    }

    const lines = await db
      .select()
      .from(cellarReleaseRequestItems)
      .where(eq(cellarReleaseRequestItems.requestId, request.id));

    if (lines.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This request has no wines on it.',
      });
    }

    const { salesOrder } = await checkReleaseStock({
      request,
      lines,
      zohoContactId: await getMemberZohoCustomer(ctx.partner.id),
      audience: 'member',
    });

    const order = await raiseReleaseOrder({
      request,
      lines,
      confirmedBy: ctx.user.id,
      salesOrder,
    });

    await notifyReleaseUpdate({
      event: 'accepted',
      partnerId: ctx.partner.id,
      requestId: request.id,
      requestNumber: request.requestNumber,
    });

    return { orderNumber: order.orderNumber, bottles: order.bottles };
  });

export default memberAcceptRelease;
