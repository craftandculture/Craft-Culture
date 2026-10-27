import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { quotes, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import computeQuoteCommissions from '../utils/computeQuoteCommissions';

const commissionsMarkPaidSchema = z.object({
  quoteId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Mark commission as paid out for a quote (admin only)
 *
 * Generates a payment reference in the format: {QuoteName}-{UserName}
 *
 * @example
 *   await trpcClient.commissions.markPaid.mutate({
 *     quoteId: "uuid-here",
 *     notes: "Paid via bank transfer"
 *   });
 */
const commissionsMarkPaid = adminProcedure
  .input(commissionsMarkPaidSchema)
  .mutation(async ({ input, ctx: { user: admin } }) => {
    const { quoteId, notes } = input;

    // Get quote with user info
    const [quoteData] = await db
      .select({
        quote: quotes,
        userName: users.name,
        customerType: users.customerType,
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.userId, users.id))
      .where(eq(quotes.id, quoteId))
      .limit(1);

    if (!quoteData) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    // Verify quote belongs to B2C user
    if (quoteData.customerType !== 'b2c') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only B2C users earn commission',
      });
    }

    // Verify quote has earned commission (correct status)
    const earnedStatuses = ['po_confirmed', 'paid', 'delivered'];
    if (!earnedStatuses.includes(quoteData.quote.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Quote must be in a completed status to pay commission. Current status: ${quoteData.quote.status}`,
      });
    }

    // Verify commission hasn't already been paid
    if (quoteData.quote.commissionPaidOutAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Commission has already been paid out for this quote',
      });
    }

    // Generate payment reference: {QuoteName}-{UserName}
    const sanitizeName = (name: string) =>
      name
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 30);

    const quoteName = sanitizeName(quoteData.quote.name);
    const userName = sanitizeName(quoteData.userName || 'Unknown');
    const payoutReference = `${quoteName}-${userName}`;

    // Update quote with payout info
    const [updatedQuote] = await db
      .update(quotes)
      .set({
        commissionPaidOutAt: new Date(),
        commissionPaidOutBy: admin.id,
        commissionPayoutReference: payoutReference,
        commissionPayoutNotes: notes,
      })
      // Only while still unpaid, so a double press cannot pay it twice
      .where(and(eq(quotes.id, quoteId), isNull(quotes.commissionPaidOutAt)))
      .returning();

    if (!updatedQuote) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Commission has already been paid out for this quote',
      });
    }

    // Commission worked out on the server, not the figure the quote was saved with
    const commissionAmount =
      (await computeQuoteCommissions([updatedQuote])).get(updatedQuote.id)?.commissionUsd ?? 0;

    return {
      success: true,
      quoteId: updatedQuote.id,
      payoutReference,
      commissionAmount,
      paidOutAt: updatedQuote.commissionPaidOutAt,
    };
  });

export default commissionsMarkPaid;
