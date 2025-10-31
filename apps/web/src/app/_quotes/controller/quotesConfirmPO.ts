import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import confirmPOSchema from '../schemas/confirmPOSchema';

/**
 * Confirm a purchase order (admin only)
 *
 * Transitions status from 'po_submitted' to 'po_confirmed'
 * This is the final step in the quote workflow
 *
 * @example
 *   await trpcClient.quotes.confirmPO.mutate({
 *     quoteId: "uuid-here",
 *     poConfirmationNotes: "Order processed and shipped"
 *   });
 */
const quotesConfirmPO = adminProcedure
  .input(confirmPOSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { quoteId, poConfirmationNotes } = input;

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
    if (existingQuote.status !== 'po_submitted') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot confirm PO for quote with status '${existingQuote.status}'`,
      });
    }

    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          status: 'po_confirmed',
          poConfirmedAt: new Date(),
          poConfirmedBy: user.id,
          poConfirmationNotes,
        })
        .where(eq(quotes.id, quoteId))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to confirm PO',
        });
      }

      // Send notification to quote owner (fire and forget)
      const { default: notifyUserOfPOConfirmation } = await import(
        '../utils/notifyUserOfPOConfirmation'
      );
      notifyUserOfPOConfirmation(updatedQuote).catch((error) =>
        console.error('Failed to send PO confirmation notification:', error),
      );

      // TODO: Log admin activity

      return updatedQuote;
    } catch (error) {
      console.error('Error confirming PO:', { error, quoteId, adminId: user.id });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to confirm PO',
      });
    }
  });

export default quotesConfirmPO;
