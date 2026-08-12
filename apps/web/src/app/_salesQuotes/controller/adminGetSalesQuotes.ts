import { and, desc, eq, ilike, or } from 'drizzle-orm';

import db from '@/database/client';
import { salesQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { listSalesQuotesSchema } from '../schemas/salesQuoteSchemas';

/**
 * List sales quotes for the internal dashboard, newest first.
 *
 * Line payloads are omitted — the list only needs headers and totals, and a
 * quote can carry a hundred lines.
 */
const adminGetSalesQuotes = adminProcedure
  .input(listSalesQuotesSchema)
  .query(async ({ input }) => {
    const { status, client, search } = input;

    const conditions = [];
    if (status) conditions.push(eq(salesQuotes.status, status));
    if (client) conditions.push(eq(salesQuotes.client, client));
    if (search) {
      conditions.push(
        or(
          ilike(salesQuotes.client, `%${search}%`),
          ilike(salesQuotes.quoteRef, `%${search}%`),
          ilike(salesQuotes.slug, `%${search}%`),
        )!,
      );
    }

    return await db
      .select({
        id: salesQuotes.id,
        slug: salesQuotes.slug,
        status: salesQuotes.status,
        quoteRef: salesQuotes.quoteRef,
        client: salesQuotes.client,
        clientCompany: salesQuotes.clientCompany,
        contactName: salesQuotes.contactName,
        validUntil: salesQuotes.validUntil,
        totalBottles: salesQuotes.totalBottles,
        totalUsd: salesQuotes.totalUsd,
        publishedAt: salesQuotes.publishedAt,
        createdAt: salesQuotes.createdAt,
        updatedAt: salesQuotes.updatedAt,
      })
      .from(salesQuotes)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(salesQuotes.updatedAt));
  });

export default adminGetSalesQuotes;
