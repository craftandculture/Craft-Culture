import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { salesQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { salesQuoteIdSchema } from '../schemas/salesQuoteSchemas';

/**
 * Load one sales quote in full, including its lines, for editing.
 */
const adminGetSalesQuote = adminProcedure
  .input(salesQuoteIdSchema)
  .query(async ({ input }) => {
    const [quote] = await db
      .select()
      .from(salesQuotes)
      .where(eq(salesQuotes.id, input.id))
      .limit(1);

    if (!quote) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });
    }

    return quote;
  });

export default adminGetSalesQuote;
