import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsQuoteRequests, logisticsQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Set what the client is quoted for a request, against one forwarder quote
 *
 * The price is ours to choose; the page shows the margin over the chosen
 * quote. `copied` records that the client email was copied, which takes the
 * request off the "price not sent" list. Changing the price after that clears
 * it, because the client has not seen the new figure; `copied: false` undoes
 * a copy made by mistake.
 *
 * @example
 *   await trpcClient.logistics.admin.requests.setClientPrice.mutate({ requestId, quoteId, clientPriceUsd: 3200 });
 */
const adminSetClientPrice = adminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      quoteId: z.string().uuid().nullable(),
      clientPriceUsd: z.number().positive().nullable(),
      copied: z.boolean().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const [request] = await db
      .select({
        id: logisticsQuoteRequests.id,
        clientPriceUsd: logisticsQuoteRequests.clientPriceUsd,
        clientQuoteId: logisticsQuoteRequests.clientQuoteId,
        clientQuotedAt: logisticsQuoteRequests.clientQuotedAt,
      })
      .from(logisticsQuoteRequests)
      .where(eq(logisticsQuoteRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote request not found' });
    }

    if (input.quoteId) {
      const [quote] = await db
        .select({ id: logisticsQuotes.id })
        .from(logisticsQuotes)
        .where(and(eq(logisticsQuotes.id, input.quoteId), eq(logisticsQuotes.requestId, request.id)))
        .limit(1);

      if (!quote) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'That quote does not answer this request' });
      }
    }

    const changed = request.clientPriceUsd !== input.clientPriceUsd || request.clientQuoteId !== input.quoteId;

    const [updated] = await db
      .update(logisticsQuoteRequests)
      .set({
        clientPriceUsd: input.clientPriceUsd,
        clientQuoteId: input.quoteId,
        // true: the client email was just copied; false: that copy was undone
        clientQuotedAt:
          input.copied === true ? new Date() : input.copied === false || changed ? null : request.clientQuotedAt,
        updatedAt: new Date(),
      })
      .where(eq(logisticsQuoteRequests.id, request.id))
      .returning({
        clientPriceUsd: logisticsQuoteRequests.clientPriceUsd,
        clientQuoteId: logisticsQuoteRequests.clientQuoteId,
        clientQuotedAt: logisticsQuoteRequests.clientQuotedAt,
      });

    if (!updated) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The change was not saved' });
    }

    return updated;
  });

export default adminSetClientPrice;
