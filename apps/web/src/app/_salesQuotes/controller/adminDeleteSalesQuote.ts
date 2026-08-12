import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { salesQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { salesQuoteIdSchema } from '../schemas/salesQuoteSchemas';

/**
 * Delete a sales quote outright.
 *
 * A published quote is refused: its link may already be with a client, and a
 * dead URL is worse than a withdrawn offer. Unpublish first, which takes the
 * page down while keeping the record.
 */
const adminDeleteSalesQuote = adminProcedure
  .input(salesQuoteIdSchema)
  .mutation(async ({ input }) => {
    const [existing] = await db
      .select({ status: salesQuotes.status })
      .from(salesQuotes)
      .where(eq(salesQuotes.id, input.id))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });
    }

    if (existing.status === 'published') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Unpublish this quote before deleting it',
      });
    }

    await db.delete(salesQuotes).where(eq(salesQuotes.id, input.id));

    return { id: input.id };
  });

export default adminDeleteSalesQuote;
