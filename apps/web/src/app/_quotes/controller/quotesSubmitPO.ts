import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import submitPOSchema from '../schemas/submitPOSchema';

/**
 * Submit a purchase order for a confirmed quote
 *
 * Transitions status from 'cc_confirmed' to 'po_submitted'
 *
 * @example
 *   await trpcClient.quotes.submitPO.mutate({
 *     quoteId: "uuid-here",
 *     poNumber: "PO-2024-001",
 *     poAttachmentUrl: "https://..."
 *   });
 */
const quotesSubmitPO = protectedProcedure
  .input(submitPOSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { quoteId, poNumber, poAttachmentUrl } = input;

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
    if (existingQuote.status !== 'cc_confirmed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot submit PO for quote with status '${existingQuote.status}'`,
      });
    }

    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          status: 'po_submitted',
          poNumber,
          poAttachmentUrl,
          poSubmittedAt: new Date(),
          poSubmittedBy: user.id,
        })
        .where(and(eq(quotes.id, quoteId), eq(quotes.userId, user.id)))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to submit PO',
        });
      }

      // Send notification to admins (fire and forget)
      const { default: notifyAdminsOfPOSubmission } = await import(
        '../utils/notifyAdminsOfPOSubmission'
      );
      notifyAdminsOfPOSubmission(updatedQuote).catch((error) =>
        logger.error('Failed to send PO submission notification', { error }),
      );

      return updatedQuote;
    } catch (error) {
      logger.error('Error submitting PO', { error, quoteId, userId: user.id });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to submit PO',
      });
    }
  });

export default quotesSubmitPO;
