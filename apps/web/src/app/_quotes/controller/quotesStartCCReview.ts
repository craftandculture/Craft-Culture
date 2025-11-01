import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import startCCReviewSchema from '../schemas/startCCReviewSchema';

/**
 * Start C&C review on a quote (admin only)
 *
 * Transitions status from 'buy_request_submitted' to 'under_cc_review'
 *
 * @example
 *   await trpcClient.quotes.startCCReview.mutate({
 *     quoteId: "uuid-here",
 *     ccNotes: "Checking with supplier X"
 *   });
 */
const quotesStartCCReview = adminProcedure
  .input(startCCReviewSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { quoteId, ccNotes } = input;

    // Verify quote exists
    const [existingQuote] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, quoteId))
      .limit(1);

    if (!existingQuote) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    // Verify quote is in correct status
    if (existingQuote.status !== 'buy_request_submitted') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot start review for quote with status '${existingQuote.status}'`,
      });
    }

    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          status: 'under_cc_review',
          ccReviewStartedAt: new Date(),
          ccReviewedBy: user.id,
          ccNotes,
        })
        .where(eq(quotes.id, quoteId))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to start C&C review',
        });
      }

      // Send notification to quote owner (fire and forget)
      const { default: notifyUserOfReviewStart } = await import(
        '../utils/notifyUserOfReviewStart'
      );
      notifyUserOfReviewStart(updatedQuote).catch((error) =>
        console.error('Failed to send review start notification:', error),
      );

      // TODO: Log admin activity

      return updatedQuote;
    } catch (error) {
      console.error('Error starting C&C review:', { error, quoteId, adminId: user.id });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to start C&C review',
      });
    }
  });

export default quotesStartCCReview;
