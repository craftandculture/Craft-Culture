import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import getQuoteByIdSchema from '../schemas/getQuoteByIdSchema';

/**
 * Delete any quote by ID (admin only)
 *
 * Permanently removes a quote from the database. Use with caution.
 *
 * @example
 *   await trpcClient.quotes.deleteAdmin.mutate({ id: "uuid-here" });
 */
const quotesDeleteAdmin = adminProcedure
  .input(getQuoteByIdSchema)
  .mutation(async ({ input }) => {
    const { id } = input;

    // Verify quote exists
    const [existingQuote] = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(eq(quotes.id, id))
      .limit(1);

    if (!existingQuote) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    try {
      await db.delete(quotes).where(eq(quotes.id, id));

      return { success: true, deletedQuoteId: id };
    } catch (error) {
      logger.error('Error deleting quote (admin)', { error, quoteId: id });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete quote',
      });
    }
  });

export default quotesDeleteAdmin;
