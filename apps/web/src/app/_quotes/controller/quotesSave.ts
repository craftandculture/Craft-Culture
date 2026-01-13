import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { quotes } from '@/database/schema';
import logger from '@/lib/logger';
import { protectedProcedure } from '@/lib/trpc/procedures';
import logUserActivity from '@/utils/logUserActivity';

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

      // Log quote creation activity
      void logUserActivity({
        userId: user.id,
        action: 'quote.created',
        entityType: 'quote',
        entityId: quote.id,
        metadata: {
          quoteName: quote.name,
          clientName: quote.clientName,
          clientCompany: quote.clientCompany,
        },
      });

      return quote;
    } catch (error) {
      logger.error('Error saving quote', {
        error,
        userId: user.id,
        quoteName: input.name,
      });

      // If it's already a TRPCError, re-throw it
      if (error instanceof TRPCError) {
        throw error;
      }

      // Otherwise throw a generic error with more context
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to save quote',
        cause: error,
      });
    }
  });

export default quotesSave;
