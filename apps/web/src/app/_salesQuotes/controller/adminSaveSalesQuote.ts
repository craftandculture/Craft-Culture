import { TRPCError } from '@trpc/server';
import { and, eq, ne } from 'drizzle-orm';

import db from '@/database/client';
import { salesQuotes } from '@/database/schema';
import type { SalesQuoteLine } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { saveSalesQuoteSchema } from '../schemas/salesQuoteSchemas';
import quoteTotals from '../utils/quoteTotals';

/**
 * Create or update a sales quote.
 *
 * The slug is the public URL, so uniqueness is checked explicitly rather than
 * relying on the unique index — a caught constraint error cannot tell the user
 * which field clashed. Totals are recomputed on every save so the dashboard
 * never drifts from the lines.
 *
 * Saving never changes `status`: publishing is a separate, deliberate action.
 */
const adminSaveSalesQuote = adminProcedure
  .input(saveSalesQuoteSchema)
  .mutation(async ({ ctx, input }) => {
    const { id, lines, options, contactEmail, ...rest } = input;

    const clash = await db
      .select({ id: salesQuotes.id })
      .from(salesQuotes)
      .where(
        id
          ? and(eq(salesQuotes.slug, input.slug), ne(salesQuotes.id, id))
          : eq(salesQuotes.slug, input.slug),
      )
      .limit(1);

    if (clash.length) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `The slug "${input.slug}" is already used by another quote`,
      });
    }

    const totals = quoteTotals(
      lines as SalesQuoteLine[],
      options.orderUnit ?? 'bottle',
    );

    const values = {
      ...rest,
      contactEmail: contactEmail || null,
      lines: lines as SalesQuoteLine[],
      options,
      validUntil: input.validUntil || null,
      promoUntil: input.promoUntil || null,
      totalBottles: totals.bottles,
      totalUsd: totals.usd,
    };

    if (id) {
      const [updated] = await db
        .update(salesQuotes)
        .set(values)
        .where(eq(salesQuotes.id, id))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });
      }

      return updated;
    }

    const [created] = await db
      .insert(salesQuotes)
      .values({ ...values, createdBy: ctx.user.id })
      .returning();

    if (!created) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create quote',
      });
    }

    return created;
  });

export default adminSaveSalesQuote;
