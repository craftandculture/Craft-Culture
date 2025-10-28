import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import getQuoteByIdSchema from '../schemas/getQuoteByIdSchema';

/**
 * Get a single quote by ID (with auth check)
 *
 * @example
 *   await trpcClient.quotes.getOne.query({ id: "uuid-here" });
 */
const quotesGetOne = protectedProcedure
  .input(getQuoteByIdSchema)
  .query(async ({ input, ctx: { user } }) => {
    const [quote] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, input.id), eq(quotes.userId, user.id)))
      .limit(1);

    if (!quote) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote not found',
      });
    }

    return quote;
  });

export default quotesGetOne;
