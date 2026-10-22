import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsQuoteEmails,
  logisticsQuoteLineItems,
  logisticsQuoteRequests,
  logisticsQuotes,
} from '@/database/schema';
import logger from '@/utils/logger';

import buildFreightEmail from '../utils/buildFreightEmail';
import logisticsEmailTemplateId from '../utils/logisticsEmailTemplateId';
import sendLogisticsEmail from '../utils/sendLogisticsEmail';

/**
 * Send the client their freight quotation from logistics@
 *
 * Written exactly as the page shows it, from the client price and the quote
 * it was set on; it never names the forwarder or their price. The address
 * given is kept on the request as the client's, the send is logged with the
 * forwarder emails, and the request is marked as quoted to the client, as
 * copying the text does.
 *
 * @example
 *   await sendClientQuote({ requestId, to: 'client@example.com' }, user);
 *
 * @param input - The request, and the client's email when it is not yet held
 * @param user - Who is sending; signs the email
 * @returns Where it went
 */
const sendClientQuote = async (
  input: { requestId: string; to?: string },
  user: { id: string; name: string | null },
) => {
  if (!logisticsEmailTemplateId()) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Sending from logistics@ is not set up yet; copy the email instead',
    });
  }

  const [request] = await db
    .select()
    .from(logisticsQuoteRequests)
    .where(eq(logisticsQuoteRequests.id, input.requestId))
    .limit(1);

  if (!request) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote request not found' });
  }

  const to = input.to?.trim() || request.clientEmail;

  if (!to) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: "Add the client's email first" });
  }

  if (request.clientPriceUsd == null || !request.clientQuoteId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Set the client price first' });
  }

  const [quote] = await db
    .select()
    .from(logisticsQuotes)
    .where(eq(logisticsQuotes.id, request.clientQuoteId))
    .limit(1);

  if (!quote) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'The quote the price was set on is no longer on file' });
  }

  const categories = await db
    .select({ category: logisticsQuoteLineItems.category })
    .from(logisticsQuoteLineItems)
    .where(eq(logisticsQuoteLineItems.quoteId, quote.id));

  const email = buildFreightEmail({
    kind: 'client_quote',
    request,
    quote: {
      quoteNumber: quote.quoteNumber,
      forwarderReference: quote.forwarderReference,
      totalPrice: quote.totalPrice,
      currency: quote.currency,
      transitDays: quote.transitDays,
      validUntil: quote.validUntil,
      categories: categories.map((c) => c.category),
    },
    clientPriceUsd: request.clientPriceUsd,
    senderName: user.name || 'Craft & Culture',
  });

  const sent = await sendLogisticsEmail({ to, subject: email.subject, body: email.body });

  await db.insert(logisticsQuoteEmails).values({
    requestId: request.id,
    forwarderId: null,
    quoteId: quote.id,
    kind: 'client_quote',
    toEmails: [to],
    subject: email.subject,
    body: email.body,
    status: sent.ok ? 'sent' : 'failed',
    error: sent.error,
    sentBy: user.id,
  });

  if (!sent.ok) {
    logger.error('Client freight quote failed', { requestId: request.id, error: sent.error });
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: sent.error || 'The email could not be sent' });
  }

  await db
    .update(logisticsQuoteRequests)
    .set({
      clientQuotedAt: new Date(),
      ...(input.to?.trim() && { clientEmail: input.to.trim() }),
      updatedAt: new Date(),
    })
    .where(eq(logisticsQuoteRequests.id, request.id));

  return { to };
};

export default sendClientQuote;
