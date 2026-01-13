import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { quotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import markAsPaidSchema from '../schemas/markAsPaidSchema';
import notifyUserOfPayment from '../utils/notifyUserOfPayment';

/**
 * Mark a B2C quote as paid after payment is received (admin only)
 *
 * Transitions status from 'awaiting_payment' to 'paid'
 *
 * @example
 *   await trpcClient.quotes.markAsPaid.mutate({
 *     quoteId: "uuid-here",
 *     paymentReference: "TXN123456",
 *     notes: "Payment confirmed via bank transfer"
 *   });
 */
const quotesMarkAsPaid = adminProcedure
  .input(markAsPaidSchema)
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

    // Verify quote is in correct status
    if (existingQuote.status !== 'awaiting_payment') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot mark quote as paid with status '${existingQuote.status}'`,
      });
    }

    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          status: 'paid',
          paidAt: new Date(),
          paidConfirmedBy: user.id,
        })
        .where(eq(quotes.id, quoteId))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update quote status',
        });
      }

      // Send notification to customer that payment was received (fire-and-forget)
      void notifyUserOfPayment(updatedQuote);

      // Log admin activity
      void logAdminActivity({
        adminId: user.id,
        action: 'payment.confirmed',
        entityType: 'quote',
        entityId: updatedQuote.id,
        metadata: {
          quoteName: updatedQuote.name,
          clientName: updatedQuote.clientName,
        },
      });

      return updatedQuote;
    } catch (error) {
      logger.error('Error marking quote as paid', { error, quoteId, adminId: user.id });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to mark quote as paid',
      });
    }
  });

export default quotesMarkAsPaid;
