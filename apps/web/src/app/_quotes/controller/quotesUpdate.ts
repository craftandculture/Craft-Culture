import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

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
    const existingQuote = await db.query.quotes.findFirst({
      where: and(eq(quotes.id, id), eq(quotes.userId, user.id)),
    });

    if (!existingQuote) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set(updates)
        .where(and(eq(quotes.id, id), eq(quotes.userId, user.id)))
        .returning();

      if (!updatedQuote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update quote',
        });
      }

      return updatedQuote;
    } catch (error) {
      console.error('Error updating quote:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update quote',
      });
    }
  });

export default quotesUpdate;
