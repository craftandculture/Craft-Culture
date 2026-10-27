import { TRPCError } from '@trpc/server';
import { and, eq, isNull, notInArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsQuoteRequestRecipients, logisticsQuoteRequests } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import findOrCreateForwarder from '../data/findOrCreateForwarder';

/**
 * Choose which forwarders a quote request goes to
 *
 * Adds the forwarders ticked, and a new one typed in by name and email.
 * Unticking removes a forwarder only while nothing has been sent to it; one
 * already asked stays on the request, so its reply can still be recorded.
 *
 * @example
 *   await trpcClient.logistics.admin.requests.setRecipients.mutate({ requestId, forwarderIds: [a, b] });
 */
const adminSetRequestRecipients = adminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      forwarderIds: z.array(z.string().uuid()).max(20),
      newForwarder: z
        .object({ name: z.string().trim().min(1), email: z.string().trim().email().optional().or(z.literal('')) })
        .optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const [request] = await db
      .select({ id: logisticsQuoteRequests.id })
      .from(logisticsQuoteRequests)
      .where(eq(logisticsQuoteRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote request not found' });
    }

    const ids = new Set(input.forwarderIds);

    if (input.newForwarder) {
      const added = await findOrCreateForwarder({
        name: input.newForwarder.name,
        email: input.newForwarder.email || null,
        addedBy: ctx.user.id,
      });
      ids.add(added.id);
    }

    await db
      .delete(logisticsQuoteRequestRecipients)
      .where(
        and(
          eq(logisticsQuoteRequestRecipients.requestId, request.id),
          isNull(logisticsQuoteRequestRecipients.sentAt),
          eq(logisticsQuoteRequestRecipients.outcome, 'awaiting'),
          ids.size ? notInArray(logisticsQuoteRequestRecipients.forwarderId, [...ids]) : undefined,
        ),
      );

    if (ids.size) {
      await db
        .insert(logisticsQuoteRequestRecipients)
        .values([...ids].map((forwarderId) => ({ requestId: request.id, forwarderId })))
        .onConflictDoNothing();
    }

    return { forwarderIds: [...ids] };
  });

export default adminSetRequestRecipients;
