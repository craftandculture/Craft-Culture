import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import markAsDeliveredSchema from '../schemas/markAsDeliveredSchema';
import notifyUserOfDelivery from '../utils/notifyUserOfDelivery';

/**
 * Mark a quote as delivered (admin only)
 *
 * Transitions status from 'paid' or 'po_confirmed' to 'delivered'
 * This marks the order as complete and closed.
 *
 * @example
 *   await trpcClient.quotes.markAsDelivered.mutate({
 *     quoteId: "uuid-here",
 *   });
 */
const quotesMarkAsDelivered = adminProcedure
  .input(markAsDeliveredSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { quoteId } = input;

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

    // Verify quote is in correct status (paid for B2C, po_confirmed for B2B)
    const validStatuses = ['paid', 'po_confirmed'];
    if (!validStatuses.includes(existingQuote.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot mark quote as delivered with status '${existingQuote.status}'`,
      });
    }

    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          status: 'delivered',
          deliveredAt: new Date(),
          deliveredConfirmedBy: user.id,
        })
        .where(eq(quotes.id, quoteId))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update quote status',
        });
      }

      // Send notification to customer that order was delivered (fire-and-forget)
      void notifyUserOfDelivery(updatedQuote);

      return updatedQuote;
    } catch (error) {
      console.error('Error marking quote as delivered:', { error, quoteId, adminId: user.id });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to mark quote as delivered',
      });
    }
  });

export default quotesMarkAsDelivered;
