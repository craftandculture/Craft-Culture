import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import getQuoteByIdSchema from '../schemas/getQuoteByIdSchema';

/**
 * Delete a quote by ID
 *
 * @example
 *   await trpcClient.quotes.delete.mutate({ id: "uuid-here" });
 */
const quotesDelete = protectedProcedure
  .input(getQuoteByIdSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    // Verify quote exists and belongs to user
    const existingQuote = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, input.id), eq(quotes.userId, user.id)))
      .limit(1);

    if (!existingQuote || existingQuote.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    try {
      await db
        .delete(quotes)
        .where(and(eq(quotes.id, input.id), eq(quotes.userId, user.id))!);

      return { success: true };
    } catch (error) {
      logger.error('Error deleting quote', { error });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete quote',
      });
    }
  });

export default quotesDelete;
