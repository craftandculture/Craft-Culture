import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsForwarders,
  logisticsQuoteEmails,
  logisticsQuoteLineItems,
  logisticsQuoteRequestRecipients,
  logisticsQuoteRequests,
  logisticsQuotes,
} from '@/database/schema';
import logger from '@/utils/logger';

import buildFreightEmail from '../utils/buildFreightEmail';
import logisticsEmailTemplateId from '../utils/logisticsEmailTemplateId';
import sendLogisticsEmail from '../utils/sendLogisticsEmail';

/**
 * Send a freight email from logistics@ to one or more forwarders
 *
 * Each forwarder gets its own email, written from the request exactly as the
 * page shows it: the request or a reminder, or once a quote is accepted, the
 * award to its forwarder and a note to the others. Each is logged on the
 * request, and a request or reminder that went is recorded on the forwarder. A
 * forwarder whose email failed is left as it was.
 *
 * @example
 *   await sendFreightEmails(
 *     { requestId, kind: 'request', forwarderIds: [a, b] },
 *     user,
 *   );
 *
 * @param input - The request, which email, and the forwarders it goes to
 * @param user - Who is sending; signs the email
 * @returns Each forwarder's outcome, with counts sent and failed
 */
const sendFreightEmails = async (
  input: {
    requestId: string;
    kind: 'request' | 'chase' | 'award' | 'decline';
    forwarderIds: string[];
  },
  user: { id: string; name: string | null },
) => {
  if (!logisticsEmailTemplateId()) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message:
        'Sending from logistics@ is not set up yet; copy the email instead',
    });
  }

  const [request] = await db
    .select()
    .from(logisticsQuoteRequests)
    .where(eq(logisticsQuoteRequests.id, input.requestId))
    .limit(1);

  if (!request) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Quote request not found',
    });
  }

  // Forwarders cannot price a consignment with no size; ask for it before anything goes out
  if (
    input.kind === 'request' &&
    !request.totalCases &&
    !request.totalBottles &&
    !request.totalWeightKg &&
    !request.totalPallets
  ) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message:
        'Add the cases, bottles, pallets or weight before sending; forwarders cannot quote without them',
    });
  }

  const forwarders = await db
    .select()
    .from(logisticsForwarders)
    .where(inArray(logisticsForwarders.id, input.forwarderIds));

  // Award and decline are about the accepted quote; each decline names that forwarder's own quote if it sent one
  const quotes = await db
    .select()
    .from(logisticsQuotes)
    .where(eq(logisticsQuotes.requestId, request.id));
  const won = quotes.find((q) => q.status === 'accepted');

  if ((input.kind === 'award' || input.kind === 'decline') && !won) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'No quote on this request has been accepted yet',
    });
  }

  const categories = quotes.length
    ? await db
        .select({
          quoteId: logisticsQuoteLineItems.quoteId,
          category: logisticsQuoteLineItems.category,
        })
        .from(logisticsQuoteLineItems)
        .where(
          inArray(
            logisticsQuoteLineItems.quoteId,
            quotes.map((q) => q.id),
          ),
        )
    : [];
  const asQuote = (q: (typeof quotes)[number]) => ({
    quoteNumber: q.quoteNumber,
    forwarderReference: q.forwarderReference,
    totalPrice: q.totalPrice,
    currency: q.currency,
    transitDays: q.transitDays,
    validUntil: q.validUntil,
    categories: categories
      .filter((c) => c.quoteId === q.id)
      .map((c) => c.category),
  });

  const senderName = user.name || 'Craft & Culture';
  const results: {
    forwarderId: string;
    name: string;
    ok: boolean;
    error: string | null;
  }[] = [];

  for (const forwarder of forwarders) {
    const contacts = forwarder.contacts;

    if (contacts.length === 0) {
      results.push({
        forwarderId: forwarder.id,
        name: forwarder.name,
        ok: false,
        error: 'No email address on file',
      });
      continue;
    }

    const own =
      quotes.find((q) => q.forwarderId === forwarder.id && q.id !== won?.id) ??
      null;
    // One email per person, greeted by name, so nobody sees another forwarder's contacts
    const emailFor = (contact: (typeof contacts)[number]) => {
      const one = { name: forwarder.name, contacts: [contact] };

      return input.kind === 'request' || input.kind === 'chase'
        ? buildFreightEmail({
            kind: input.kind,
            request,
            forwarders: [one],
            senderName,
          })
        : buildFreightEmail({
            kind: input.kind,
            request,
            forwarder: one,
            quote:
              input.kind === 'award'
                ? asQuote(won!)
                : own
                  ? asQuote(own)
                  : { ...asQuote(won!), forwarderReference: null },
            senderName,
          });
    };

    // Sent if it reached at least one of the forwarder's people; each failure is kept
    let ok = false;
    const errors: string[] = [];
    for (const contact of contacts) {
      const email = emailFor(contact);
      const sent = await sendLogisticsEmail({
        to: contact.email,
        subject: email.subject,
        body: email.body,
      });

      if (sent.ok) ok = true;
      else errors.push(`${contact.email}: ${sent.error}`);

      await db.insert(logisticsQuoteEmails).values({
        requestId: request.id,
        forwarderId: forwarder.id,
        quoteId: input.kind === 'award' ? won!.id : (own?.id ?? null),
        kind: input.kind,
        toEmails: [contact.email],
        subject: email.subject,
        body: email.body,
        status: sent.ok ? 'sent' : 'failed',
        error: sent.error,
        sentBy: user.id,
      });
    }
    const error = errors.length ? errors.join('; ') : null;

    if (ok && (input.kind === 'request' || input.kind === 'chase')) {
      const now = new Date();
      await db
        .update(logisticsQuoteRequestRecipients)
        .set(
          input.kind === 'request'
            ? { sentAt: now, sentBy: user.id, updatedAt: now }
            : { chasedAt: now, updatedAt: now },
        )
        .where(
          and(
            eq(logisticsQuoteRequestRecipients.requestId, request.id),
            eq(logisticsQuoteRequestRecipients.forwarderId, forwarder.id),
          ),
        );
    }

    if (!ok) {
      logger.error('Freight email failed', {
        requestId: request.id,
        forwarder: forwarder.name,
        kind: input.kind,
        error,
      });
    }

    results.push({
      forwarderId: forwarder.id,
      name: forwarder.name,
      ok,
      error,
    });
  }

  if (
    input.kind === 'request' &&
    results.some((r) => r.ok) &&
    request.status === 'pending'
  ) {
    await db
      .update(logisticsQuoteRequests)
      .set({
        status: 'in_progress',
        assignedTo: user.id,
        assignedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(logisticsQuoteRequests.id, request.id));
  }

  return {
    results,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
  };
};

export default sendFreightEmails;
