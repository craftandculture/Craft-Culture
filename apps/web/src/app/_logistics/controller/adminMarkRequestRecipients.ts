import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsQuoteRequestRecipients, logisticsQuoteRequests } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Record that a request or a reminder went to forwarders
 *
 * Called when someone copies the email, so sending needs no separate step;
 * `undo` reverses it inside the page's undo window. Marking a request sent
 * also moves the request from pending to in progress.
 *
 * @example
 *   await trpcClient.logistics.admin.requests.markRecipients.mutate({ requestId, forwarderIds: [a], action: 'sent' });
 */
const adminMarkRequestRecipients = adminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      forwarderIds: z.array(z.string().uuid()).min(1).max(20),
      action: z.enum(['sent', 'chased', 'undo_sent', 'undo_chased']),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const now = new Date();
    const set =
      input.action === 'sent'
        ? { sentAt: now, sentBy: ctx.user.id }
        : input.action === 'chased'
          ? { chasedAt: now }
          : input.action === 'undo_sent'
            ? { sentAt: null, sentBy: null }
            : { chasedAt: null };

    const rows = await db
      .update(logisticsQuoteRequestRecipients)
      .set({ ...set, updatedAt: now })
      .where(
        and(
          eq(logisticsQuoteRequestRecipients.requestId, input.requestId),
          inArray(logisticsQuoteRequestRecipients.forwarderId, input.forwarderIds),
        ),
      )
      .returning({ id: logisticsQuoteRequestRecipients.id });

    if (input.action === 'sent') {
      await db
        .update(logisticsQuoteRequests)
        .set({ status: 'in_progress', assignedTo: ctx.user.id, assignedAt: now, updatedAt: now })
        .where(and(eq(logisticsQuoteRequests.id, input.requestId), eq(logisticsQuoteRequests.status, 'pending')));
    }

    return { updated: rows.length };
  });

export default adminMarkRequestRecipients;
