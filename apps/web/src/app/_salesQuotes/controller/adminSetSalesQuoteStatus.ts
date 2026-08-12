import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { salesQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { setSalesQuoteStatusSchema } from '../schemas/salesQuoteSchemas';

/**
 * Publish, unpublish or archive a quote.
 *
 * Publishing is what makes /q/<slug> resolve, so it is kept separate from
 * saving — editing a live quote should not be able to expose it by accident,
 * and unpublishing must take it down immediately.
 *
 * `publishedAt` is stamped on first publish and preserved thereafter, so it
 * records when the client first had the link rather than the last edit.
 */
const adminSetSalesQuoteStatus = adminProcedure
  .input(setSalesQuoteStatusSchema)
  .mutation(async ({ input }) => {
    const { id, status } = input;

    const [existing] = await db
      .select({ publishedAt: salesQuotes.publishedAt })
      .from(salesQuotes)
      .where(eq(salesQuotes.id, id))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });
    }

    const [updated] = await db
      .update(salesQuotes)
      .set({
        status,
        publishedAt:
          status === 'published'
            ? (existing.publishedAt ?? new Date())
            : existing.publishedAt,
      })
      .where(eq(salesQuotes.id, id))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update quote status',
      });
    }

    return updated;
  });

export default adminSetSalesQuoteStatus;
