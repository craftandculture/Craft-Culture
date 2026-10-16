import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import assertActivated from '@/app/_onboarding/data/assertActivated';
import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import EDITABLE_STATUSES from '../utils/editableStatuses';
import notifyReleaseUpdate from '../utils/notifyReleaseUpdate';

/**
 * Hand a release request to us for review
 *
 * The member stops being able to edit at this point, which is the only way a
 * quote can mean anything: we have to be pricing the list we were given.
 */
const memberSubmitRelease = stockOwnerProcedure
  .input(z.object({ requestId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    /* A paused membership stops deliveries, the same as it stops buying. */
    await assertActivated(ctx.partner.id);

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

    if (
      !EDITABLE_STATUSES.includes(
        request.status as (typeof EDITABLE_STATUSES)[number],
      )
    ) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This request has already been submitted.',
      });
    }

    const lines = await db
      .select({ id: cellarReleaseRequestItems.id })
      .from(cellarReleaseRequestItems)
      .where(eq(cellarReleaseRequestItems.requestId, request.id));

    if (lines.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Add at least one wine before submitting.',
      });
    }

    const [submitted] = await db
      .update(cellarReleaseRequests)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cellarReleaseRequests.id, request.id),
          inArray(cellarReleaseRequests.status, [...EDITABLE_STATUSES]),
        ),
      )
      .returning({ id: cellarReleaseRequests.id });

    if (!submitted) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This request has already been submitted.',
      });
    }

    await notifyReleaseUpdate({
      event: 'submitted',
      partnerId: ctx.partner.id,
      requestId: request.id,
      requestNumber: request.requestNumber,
    });

    return { requestNumber: request.requestNumber, lines: lines.length };
  });

export default memberSubmitRelease;
