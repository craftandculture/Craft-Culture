import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import saveQuoteSchema from '../schemas/saveQuoteSchema';

/**
 * Save a new quote to the database
 *
 * @example
 *   await trpcClient.quotes.save.mutate({
 *     name: "Hotel ABC Order - January 2025",
 *     lineItems: [...],
 *     quoteData: {...},
 *     ...
 *   });
 */
const quotesSave = protectedProcedure
  .input(saveQuoteSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    try {
      const [quote] = await db
        .insert(quotes)
        .values({
          userId: user.id,
          name: input.name,
          status: 'draft',
          lineItems: input.lineItems,
          quoteData: input.quoteData,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          clientCompany: input.clientCompany,
          notes: input.notes,
          currency: input.currency,
          totalUsd: input.totalUsd,
          totalAed: input.totalAed,
          expiresAt: input.expiresAt,
        })
        .returning();

      if (!quote) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save quote',
        });
      }

      return quote;
    } catch (error) {
      console.error('Error saving quote:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save quote',
      });
    }
  });

export default quotesSave;
