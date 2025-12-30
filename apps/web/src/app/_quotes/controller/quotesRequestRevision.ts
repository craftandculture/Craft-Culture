import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { quotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import requestRevisionSchema from '../schemas/requestRevisionSchema';

/**
 * Request revision on a quote (admin only)
 *
 * Transitions status from 'under_cc_review' to 'revision_requested'
 * Stores revision history for audit trail
 *
 * @example
 *   await trpcClient.quotes.requestRevision.mutate({
 *     quoteId: "uuid-here",
 *     revisionReason: "Vintage unavailable, alternatives suggested",
 *     revisionSuggestions: {
 *       items: [{
 *         lineItemIndex: 0,
 *         issue: "2015 vintage unavailable",
 *         alternatives: [
 *           { vintage: "2016", availability: "50 cases", priceAdjustment: "+5%" }
 *         ]
 *       }],
 *       generalNotes: "Can offer better pricing at higher volumes"
 *     }
 *   });
 */
const quotesRequestRevision = adminProcedure
  .input(requestRevisionSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { quoteId, revisionReason, revisionSuggestions } = input;

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
        message: `Cannot request revision for quote with status '${existingQuote.status}'`,
      });
    }

    try {
      // Build revision history entry
      const revisionEntry = {
        requestedAt: new Date().toISOString(),
        requestedBy: user.id,
        reason: revisionReason,
        suggestions: revisionSuggestions,
      };

      // Get existing revision history
      const existingHistory = (existingQuote.revisionHistory as Array<unknown>) || [];
      const updatedHistory = [...existingHistory, revisionEntry];

      const [updatedQuote] = await db
        .update(quotes)
        .set({
          status: 'revision_requested',
          revisionRequestedAt: new Date(),
          revisionRequestedBy: user.id,
          revisionReason,
          revisionSuggestions,
          revisionHistory: updatedHistory,
        })
        .where(eq(quotes.id, quoteId))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to request revision',
        });
      }

      // Send notification to quote owner (fire and forget)
      const { default: notifyUserOfRevisionRequest } = await import(
        '../utils/notifyUserOfRevisionRequest'
      );
      notifyUserOfRevisionRequest(updatedQuote).catch((error) =>
        console.error('Failed to send revision request notification:', error),
      );

      // Log admin activity
      void logAdminActivity({
        adminId: user.id,
        action: 'quote.revision_requested',
        entityType: 'quote',
        entityId: updatedQuote.id,
        metadata: {
          quoteName: updatedQuote.name,
          clientName: updatedQuote.clientName,
          revisionReason,
        },
      });

      return updatedQuote;
    } catch (error) {
      console.error('Error requesting revision:', { error, quoteId, adminId: user.id });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to request revision',
      });
    }
  });

export default quotesRequestRevision;
