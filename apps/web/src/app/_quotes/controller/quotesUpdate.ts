import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import updateQuoteSchema from '../schemas/updateQuoteSchema';

/**
 * Update an existing quote
 *
 * @example
 *   await trpcClient.quotes.update.mutate({
 *     id: "uuid-here",
 *     name: "Updated Quote Name",
 *     status: "sent"
 *   });
 */
const quotesUpdate = protectedProcedure
  .input(updateQuoteSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { id, ...updates } = input;

    // Verify quote exists and belongs to user
    const existingQuote = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.userId, user.id)))
      .limit(1);

    if (!existingQuote || existingQuote.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set(updates)
        .where(and(eq(quotes.id, id), eq(quotes.userId, user.id))!)
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update quote',
        });
      }

      return updatedQuote;
    } catch (error) {
      logger.error('Error updating quote', { error });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update quote',
      });
    }
  });

export default quotesUpdate;
