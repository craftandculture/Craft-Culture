import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { approvedProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import updateQuoteSchema from '../schemas/updateQuoteSchema';
import buildStoredQuotePricing from '../utils/buildStoredQuotePricing';

/** A quote can only be edited by its owner before C&C has acted on it */
const EDITABLE_STATUSES = ['draft', 'revision_requested'] as const;

/**
 * Update an existing quote
 *
 * Only draft quotes and quotes sent back for revision can be edited. Prices
 * and totals are always recomputed on the server from the live offers; any
 * totals sent by the browser are ignored.
 *
 * @example
 *   await trpcClient.quotes.update.mutate({
 *     id: "uuid-here",
 *     name: "Updated Quote Name",
 *   });
 */
const quotesUpdate = approvedProcedure
  .input(updateQuoteSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const {
      id,
      quoteData: extras,
      totalUsd: _ignoredTotalUsd,
      totalAed: _ignoredTotalAed,
      ...updates
    } = input;

    const [existingQuote] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.userId, user.id)))
      .limit(1);

    if (!existingQuote) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    if (!(EDITABLE_STATUSES as readonly string[]).includes(existingQuote.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'This quote is with C&C and can no longer be edited. Ask the team to send it back for revision.',
      });
    }

    const repricing =
      updates.lineItems !== undefined ||
      extras !== undefined ||
      updates.currency !== undefined;

    let priced: Partial<typeof quotes.$inferInsert> = {};

    if (repricing) {
      const lineItems =
        updates.lineItems ??
        ((existingQuote.lineItems as { offerId: string; quantity: number }[]) ?? []);
      const currency =
        updates.currency ?? (existingQuote.currency === 'AED' ? 'AED' : 'USD');

      const result = await buildStoredQuotePricing({
        lineItems,
        extras,
        currency,
        customerType: user.customerType,
        existingQuoteData: existingQuote.quoteData as Record<string, unknown> | null,
      });

      priced = {
        quoteData: result.quoteData,
        totalUsd: result.totalUsd,
        totalAed: result.totalAed ?? null,
      };
    }

    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set({ ...updates, ...priced })
        .where(
          and(
            eq(quotes.id, id),
            eq(quotes.userId, user.id),
            // Re-check the status in the write itself so an approval that
            // lands between the read and this update is not overwritten
            inArray(quotes.status, [...EDITABLE_STATUSES]),
          ),
        )
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'The quote changed while you were editing it. Please reload.',
        });
      }

      return updatedQuote;
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      logger.error('Error updating quote', { error });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update quote',
      });
    }
  });

export default quotesUpdate;
