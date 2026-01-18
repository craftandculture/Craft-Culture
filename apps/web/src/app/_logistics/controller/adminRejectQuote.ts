import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const rejectQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  reason: z.string().optional(),
});

/**
 * Reject a freight quote
 *
 * Marks the quote as rejected with an optional reason.
 */
const adminRejectQuote = adminProcedure.input(rejectQuoteSchema).mutation(async ({ input, ctx }) => {
  const { quoteId, reason } = input;

  // Get the quote
  const [quote] = await db
    .select()
    .from(logisticsQuotes)
    .where(eq(logisticsQuotes.id, quoteId))
    .limit(1);

  if (!quote) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Quote not found',
    });
  }

  if (quote.status !== 'pending') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot reject quote with status "${quote.status}"`,
    });
  }

  try {
    const [rejectedQuote] = await db
      .update(logisticsQuotes)
      .set({
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: ctx.user.id,
        rejectionReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(logisticsQuotes.id, quoteId))
      .returning();

    logger.info('Rejected freight quote', {
      quoteId,
      reason,
      rejectedBy: ctx.user.id,
    });

    return rejectedQuote;
  } catch (error) {
    logger.error('Failed to reject freight quote', { error, quoteId });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to reject quote',
    });
  }
});

export default adminRejectQuote;
