import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import submitBuyRequestSchema from '../schemas/submitBuyRequestSchema';

/**
 * Submit a buy request on a quote
 *
 * Transitions status from 'sent' or 'revision_requested' to 'buy_request_submitted'
 *
 * @example
 *   await trpcClient.quotes.submitBuyRequest.mutate({
 *     quoteId: "uuid-here"
 *   });
 */
const quotesSubmitBuyRequest = protectedProcedure
  .input(submitBuyRequestSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { quoteId } = input;

    // Verify quote exists and belongs to user
    const [existingQuote] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, quoteId), eq(quotes.userId, user.id)))
      .limit(1);

    if (!existingQuote) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    // Verify quote is in correct status
    if (
      existingQuote.status !== 'sent' &&
      existingQuote.status !== 'revision_requested'
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot submit buy request for quote with status '${existingQuote.status}'`,
      });
    }

    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          status: 'buy_request_submitted',
          buyRequestSubmittedAt: new Date(),
          buyRequestSubmittedBy: user.id,
          buyRequestCount: existingQuote.buyRequestCount + 1,
        })
        .where(and(eq(quotes.id, quoteId), eq(quotes.userId, user.id)))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to submit buy request',
        });
      }

      // Send notification to admins (fire and forget)
      const { default: notifyAdminsOfBuyRequest } = await import(
        '../utils/notifyAdminsOfBuyRequest'
      );
      notifyAdminsOfBuyRequest(updatedQuote).catch((error) =>
        console.error('Failed to send buy request notification:', error),
      );

      return updatedQuote;
    } catch (error) {
      console.error('Error submitting buy request:', { error, quoteId, userId: user.id });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to submit buy request',
      });
    }
  });

export default quotesSubmitBuyRequest;
