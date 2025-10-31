import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import confirmQuoteSchema from '../schemas/confirmQuoteSchema';

/**
 * Confirm a quote after C&C review (admin only)
 *
 * Transitions status from 'under_cc_review' to 'cc_confirmed'
 *
 * @example
 *   await trpcClient.quotes.confirm.mutate({
 *     quoteId: "uuid-here",
 *     ccConfirmationNotes: "All items confirmed with suppliers"
 *   });
 */
const quotesConfirm = adminProcedure
  .input(confirmQuoteSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { quoteId, ccConfirmationNotes } = input;

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
    if (existingQuote.status !== 'under_cc_review') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot confirm quote with status '${existingQuote.status}'`,
      });
    }

    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          status: 'cc_confirmed',
          ccConfirmedAt: new Date(),
          ccConfirmedBy: user.id,
          ccConfirmationNotes,
        })
        .where(eq(quotes.id, quoteId))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to confirm quote',
        });
      }

      // Send notification to quote owner (fire and forget)
      const { default: notifyUserOfQuoteConfirmation } = await import(
        '../utils/notifyUserOfQuoteConfirmation'
      );
      notifyUserOfQuoteConfirmation(updatedQuote).catch((error) =>
        console.error('Failed to send quote confirmation notification:', error),
      );

      // TODO: Log admin activity

      return updatedQuote;
    } catch (error) {
      console.error('Error confirming quote:', { error, quoteId, adminId: user.id });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to confirm quote',
      });
    }
  });

export default quotesConfirm;
