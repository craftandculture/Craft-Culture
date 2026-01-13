import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';
import logUserActivity from '@/utils/logUserActivity';

import submitPaymentProofSchema from '../schemas/submitPaymentProofSchema';

/**
 * Submit payment proof for a quote
 *
 * Allows customer to submit a screenshot of their bank transfer or SWIFT payment
 *
 * @example
 *   await trpcClient.quotes.submitPaymentProof.mutate({
 *     quoteId: "uuid-here",
 *     paymentProofUrl: "https://blob.vercel-storage.com/..."
 *   });
 */
const quotesSubmitPaymentProof = protectedProcedure
  .input(submitPaymentProofSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { quoteId, paymentProofUrl } = input;

    // Verify quote exists and belongs to user
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

    if (existingQuote.userId !== user.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to modify this quote',
      });
    }

    // Can only submit payment proof when quote is awaiting payment
    if (existingQuote.status !== 'awaiting_payment') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot submit payment proof for quote with status '${existingQuote.status}'`,
      });
    }

    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          paymentProofUrl,
          paymentProofSubmittedAt: new Date(),
        })
        .where(eq(quotes.id, quoteId))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to submit payment proof',
        });
      }

      // Send notification to admins (fire and forget)
      const { default: notifyAdminsOfPaymentProof } = await import(
        '../utils/notifyAdminsOfPaymentProof'
      );
      notifyAdminsOfPaymentProof(updatedQuote).catch((error) =>
        logger.error('Failed to send payment proof notification', { error }),
      );

      // Log user activity
      void logUserActivity({
        userId: user.id,
        action: 'payment.proof_submitted',
        entityType: 'quote',
        entityId: updatedQuote.id,
        metadata: {
          quoteName: updatedQuote.name,
          clientName: updatedQuote.clientName,
        },
      });

      return updatedQuote;
    } catch (error) {
      logger.error('Error submitting payment proof', { error, quoteId, userId: user.id });

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to submit payment proof',
      });
    }
  });

export default quotesSubmitPaymentProof;
