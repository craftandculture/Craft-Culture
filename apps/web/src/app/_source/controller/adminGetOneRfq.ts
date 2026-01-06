import { TRPCError } from '@trpc/server';
import { asc, eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  partners,
  sourceRfqItems,
  sourceRfqPartners,
  sourceRfqQuotes,
  sourceRfqs,
  users,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getOneRfqSchema from '../schemas/getOneRfqSchema';

/**
 * Get a single SOURCE RFQ with all related data
 *
 * @example
 *   await trpcClient.source.admin.getOne.query({
 *     rfqId: "uuid-here"
 *   });
 */
const adminGetOneRfq = adminProcedure
  .input(getOneRfqSchema)
  .query(async ({ input }) => {
    const { rfqId } = input;

    // Get the RFQ with creator info
    const [rfqResult] = await db
      .select({
        rfq: sourceRfqs,
        createdByUser: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(sourceRfqs)
      .leftJoin(users, eq(sourceRfqs.createdBy, users.id))
      .where(eq(sourceRfqs.id, rfqId));

    if (!rfqResult) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    // Get all items ordered by sortOrder
    const items = await db
      .select()
      .from(sourceRfqItems)
      .where(eq(sourceRfqItems.rfqId, rfqId))
      .orderBy(asc(sourceRfqItems.sortOrder));

    // Get all assigned partners with partner details
    const rfqPartners = await db
      .select({
        rfqPartner: sourceRfqPartners,
        partner: {
          id: partners.id,
          businessName: partners.businessName,
          logoUrl: partners.logoUrl,
          businessEmail: partners.businessEmail,
        },
      })
      .from(sourceRfqPartners)
      .innerJoin(partners, eq(sourceRfqPartners.partnerId, partners.id))
      .where(eq(sourceRfqPartners.rfqId, rfqId));

    // Get all quotes
    const quotes = await db
      .select({
        quote: sourceRfqQuotes,
        partner: {
          id: partners.id,
          businessName: partners.businessName,
          logoUrl: partners.logoUrl,
        },
      })
      .from(sourceRfqQuotes)
      .innerJoin(partners, eq(sourceRfqQuotes.partnerId, partners.id))
      .where(eq(sourceRfqQuotes.rfqId, rfqId));

    // Build a map of quotes by item
    const quotesByItem = new Map<string, typeof quotes>();
    for (const q of quotes) {
      const itemQuotes = quotesByItem.get(q.quote.itemId) || [];
      itemQuotes.push(q);
      quotesByItem.set(q.quote.itemId, itemQuotes);
    }

    // Enrich items with their quotes
    const itemsWithQuotes = items.map((item) => ({
      ...item,
      quotes: quotesByItem.get(item.id) || [],
    }));

    return {
      ...rfqResult.rfq,
      createdByUser: rfqResult.createdByUser,
      items: itemsWithQuotes,
      partners: rfqPartners.map((rp) => ({
        ...rp.rfqPartner,
        partner: rp.partner,
      })),
    };
  });

export default adminGetOneRfq;
