import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsQuoteRequests, logisticsQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import openJobForRequest from '../data/openJobForRequest';

/**
 * Open the job for a request saved before every request had one
 *
 * Opens a draft SHP shipment from the request's route and files the request's
 * quotes that have no shipment yet against it.
 *
 * @example
 *   await trpcClient.logistics.admin.requests.openJob.mutate({ requestId });
 */
const adminOpenRequestJob = adminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      type: z
        .enum(['inbound', 'outbound', 're_export', 'mainland_transfer'])
        .optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const [request] = await db
      .select()
      .from(logisticsQuoteRequests)
      .where(eq(logisticsQuoteRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote request not found',
      });
    }

    const job = await openJobForRequest(request, {
      type: input.type,
      userId: ctx.user.id,
    });

    const quotes = await db
      .select({
        id: logisticsQuotes.id,
        shipmentId: logisticsQuotes.shipmentId,
      })
      .from(logisticsQuotes)
      .where(eq(logisticsQuotes.requestId, request.id));

    for (const quote of quotes.filter((q) => !q.shipmentId)) {
      await db
        .update(logisticsQuotes)
        .set({ shipmentId: job.id, updatedAt: new Date() })
        .where(eq(logisticsQuotes.id, quote.id));
    }

    return job;
  });

export default adminOpenRequestJob;
