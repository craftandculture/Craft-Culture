import { TRPCError } from '@trpc/server';
import { and, asc, eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  sourceRfqItems,
  sourceRfqPartners,
  sourceRfqQuotes,
  sourceRfqs,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import getOneRfqSchema from '../schemas/getOneRfqSchema';

/**
 * Get a single SOURCE RFQ for the partner to quote on
 *
 * @example
 *   await trpcClient.source.partner.getOne.query({
 *     rfqId: "uuid-here"
 *   });
 */
const partnerGetOneRfq = winePartnerProcedure
  .input(getOneRfqSchema)
  .query(async ({ input, ctx: { partnerId } }) => {
    const { rfqId } = input;

    logger.dev('[SOURCE] Partner getOne - looking up RFQ', { rfqId, partnerId });

    // Verify RFQ is assigned to this partner
    const [assignment] = await db
      .select({
        assignment: sourceRfqPartners,
        rfq: sourceRfqs,
      })
      .from(sourceRfqPartners)
      .innerJoin(sourceRfqs, eq(sourceRfqPartners.rfqId, sourceRfqs.id))
      .where(
        and(
          eq(sourceRfqPartners.rfqId, rfqId),
          eq(sourceRfqPartners.partnerId, partnerId),
        ),
      );

    if (!assignment) {
      logger.warn('[SOURCE] Partner getOne - unauthorized access attempt', {
        rfqId,
        requestingPartnerId: partnerId,
      });

      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found or not assigned to your organization',
      });
    }

    logger.dev('[SOURCE] Partner getOne - found assignment', {
      rfqId,
      partnerId,
      status: assignment.assignment.status,
    });

    // Mark as viewed if first time viewing
    if (!assignment.assignment.viewedAt) {
      await db
        .update(sourceRfqPartners)
        .set({
          viewedAt: new Date(),
          status: 'viewed',
        })
        .where(eq(sourceRfqPartners.id, assignment.assignment.id));
    }

    // Get all items
    const items = await db
      .select()
      .from(sourceRfqItems)
      .where(eq(sourceRfqItems.rfqId, rfqId))
      .orderBy(asc(sourceRfqItems.sortOrder));

    // Get partner's existing quotes
    const quotes = await db
      .select()
      .from(sourceRfqQuotes)
      .where(
        and(
          eq(sourceRfqQuotes.rfqId, rfqId),
          eq(sourceRfqQuotes.partnerId, partnerId),
        ),
      );

    // Map quotes to items - support multiple quotes per item (multiple vintages)
    const quotesByItem = new Map<string, (typeof quotes[0] & { isMyQuote: boolean })[]>();
    for (const quote of quotes) {
      const existing = quotesByItem.get(quote.itemId) || [];
      existing.push({ ...quote, isMyQuote: true });
      quotesByItem.set(quote.itemId, existing);
    }

    const itemsWithQuotes = items.map((item) => {
      const itemQuotes = quotesByItem.get(item.id) || [];
      return {
        ...item,
        // Keep myQuote for backwards compatibility (first quote)
        myQuote: itemQuotes[0] || null,
        // Add quotes array for multi-vintage support
        quotes: itemQuotes,
      };
    });

    return {
      ...assignment.rfq,
      partnerStatus: assignment.assignment.status,
      viewedAt: assignment.assignment.viewedAt,
      submittedAt: assignment.assignment.submittedAt,
      partnerNotes: assignment.assignment.partnerNotes,
      items: itemsWithQuotes,
      quoteCount: quotes.length,
    };
  });

export default partnerGetOneRfq;
