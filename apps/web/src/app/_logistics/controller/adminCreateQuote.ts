import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsForwarders,
  logisticsQuoteLineItems,
  logisticsQuoteRequestRecipients,
  logisticsQuoteRequests,
  logisticsQuotes,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import findOrCreateForwarder from '../data/findOrCreateForwarder';
import openJobForRequest from '../data/openJobForRequest';
import createQuoteSchema from '../schemas/createQuoteSchema';
import generateQuoteNumber from '../utils/generateQuoteNumber';
import isUniqueViolation from '../utils/isUniqueViolation';
import resolveFxToUsd from '../utils/resolveFxToUsd';

/**
 * Create a new freight quote
 *
 * Quote numbers are QTE-YYYY-NNNN. The forwarder is the one on file, found or
 * added from the name and email when none is chosen, and the total is also
 * stored in USD at today's rate so quotes in different currencies rank. A quote
 * that answers a request moves that request to "quoted" if it was still open,
 * and marks its forwarder as having quoted.
 *
 * No quotes without a job: a quote answers a request or belongs to a shipment,
 * and one that answers a request is filed against the request's job (opened now
 * if the request predates jobs).
 */
const adminCreateQuote = adminProcedure
  .input(createQuoteSchema)
  .mutation(async ({ input, ctx }) => {
    const { lineItems, ...quoteData } = input;

    if (!quoteData.requestId && !quoteData.shipmentId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'A quote needs its job: add it from the freight request or the shipment it is for',
      });
    }

    const [answering] = quoteData.requestId
      ? await db
          .select()
          .from(logisticsQuoteRequests)
          .where(eq(logisticsQuoteRequests.id, quoteData.requestId))
          .limit(1)
      : [];

    if (quoteData.requestId && !answering) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote request not found',
      });
    }

    const jobId =
      quoteData.shipmentId ||
      (answering
        ? (await openJobForRequest(answering, { userId: ctx.user.id })).id
        : null);

    try {
      const [chosen] = quoteData.forwarderId
        ? await db
            .select()
            .from(logisticsForwarders)
            .where(eq(logisticsForwarders.id, quoteData.forwarderId))
            .limit(1)
        : [];
      const forwarder =
        chosen ??
        (await findOrCreateForwarder({
          name: quoteData.forwarderName,
          email: quoteData.forwarderEmail,
          contactName: quoteData.forwarderContact,
        }));

      const fx = await resolveFxToUsd(quoteData.currency);
      const fxToUsd = fx.source === 'unresolved' ? null : fx.rate;

      let quote: typeof logisticsQuotes.$inferSelect | undefined;
      let quoteNumber = '';

      for (let attempt = 0; attempt < 3 && !quote; attempt++) {
        quoteNumber = await generateQuoteNumber();

        try {
          [quote] = await db
            .insert(logisticsQuotes)
            .values({
              quoteNumber,
              forwarderId: forwarder.id,
              forwarderName: forwarder.name,
              forwarderContact: quoteData.forwarderContact || null,
              forwarderEmail: quoteData.forwarderEmail || null,
              forwarderReference: quoteData.forwarderReference?.trim() || null,
              shipmentId: jobId,
              requestId: quoteData.requestId || null,
              originCountry: quoteData.originCountry || null,
              originCity: quoteData.originCity || null,
              destinationCountry: quoteData.destinationCountry || null,
              destinationCity: quoteData.destinationCity || null,
              transportMode: quoteData.transportMode || null,
              totalPrice: quoteData.totalPrice,
              currency: quoteData.currency,
              totalUsd:
                fxToUsd == null
                  ? null
                  : Math.round(quoteData.totalPrice * fxToUsd * 100) / 100,
              fxToUsd,
              transitDays: quoteData.transitDays || null,
              validFrom: quoteData.validFrom || null,
              validUntil: quoteData.validUntil || null,
              notes: quoteData.notes || null,
              internalNotes: quoteData.internalNotes || null,
              status: 'pending',
              createdBy: ctx.user.id,
            })
            .returning();
        } catch (error) {
          if (isUniqueViolation(error) && attempt < 2) continue;
          throw error;
        }
      }

      if (!quote) {
        throw new Error('Quote insert returned no row');
      }

      // Create line items if provided
      if (lineItems && lineItems.length > 0) {
        await db.insert(logisticsQuoteLineItems).values(
          lineItems.map((item, index) => ({
            quoteId: quote.id,
            category: item.category,
            description: item.description,
            unitPrice: item.unitPrice || null,
            quantity: item.quantity,
            total: item.total,
            currency: item.currency || null,
            sortOrder: index,
          })),
        );
      }

      if (quote.requestId) {
        await db
          .update(logisticsQuoteRequests)
          .set({ status: 'quoted', updatedAt: new Date() })
          .where(
            and(
              eq(logisticsQuoteRequests.id, quote.requestId),
              inArray(logisticsQuoteRequests.status, [
                'pending',
                'in_progress',
              ]),
            ),
          );

        await db
          .insert(logisticsQuoteRequestRecipients)
          .values({
            requestId: quote.requestId,
            forwarderId: forwarder.id,
            outcome: 'quoted',
          })
          .onConflictDoUpdate({
            target: [
              logisticsQuoteRequestRecipients.requestId,
              logisticsQuoteRequestRecipients.forwarderId,
            ],
            set: { outcome: 'quoted', updatedAt: new Date() },
          });
      }

      logger.info('Created freight quote', {
        quoteId: quote.id,
        quoteNumber,
        forwarder: forwarder.name,
        createdBy: ctx.user.id,
      });

      return quote;
    } catch (error) {
      logger.error('Failed to create freight quote', { error, input });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create quote',
      });
    }
  });

export default adminCreateQuote;
