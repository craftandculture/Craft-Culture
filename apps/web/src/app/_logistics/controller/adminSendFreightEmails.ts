import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsForwarders,
  logisticsQuoteEmails,
  logisticsQuoteLineItems,
  logisticsQuoteRequestRecipients,
  logisticsQuoteRequests,
  logisticsQuotes,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
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
 * request, and a request or reminder that went is recorded on the forwarder,
 * as copying it did. A forwarder whose email failed is left as it was.
 *
 * @example
 *   await trpcClient.logistics.admin.requests.sendEmails.mutate({ requestId, kind: 'request', forwarderIds: [a, b] });
 */
const adminSendFreightEmails = adminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      kind: z.enum(['request', 'chase', 'award', 'decline']),
      forwarderIds: z.array(z.string().uuid()).min(1).max(20),
    }),
  )
  .mutation(async ({ input, ctx }) => {
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

    const forwarders = await db
      .select()
      .from(logisticsForwarders)
      .where(inArray(logisticsForwarders.id, input.forwarderIds));

    // Award and decline are about the accepted quote; each decline names that forwarder's own quote if it sent one
    const quotes = await db.select().from(logisticsQuotes).where(eq(logisticsQuotes.requestId, request.id));
    const won = quotes.find((q) => q.status === 'accepted');

    if ((input.kind === 'award' || input.kind === 'decline') && !won) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No quote on this request has been accepted yet' });
    }

    const categories = quotes.length
      ? await db
          .select({ quoteId: logisticsQuoteLineItems.quoteId, category: logisticsQuoteLineItems.category })
          .from(logisticsQuoteLineItems)
          .where(inArray(logisticsQuoteLineItems.quoteId, quotes.map((q) => q.id)))
      : [];
    const asQuote = (q: (typeof quotes)[number]) => ({
      quoteNumber: q.quoteNumber,
      forwarderReference: q.forwarderReference,
      totalPrice: q.totalPrice,
      currency: q.currency,
      transitDays: q.transitDays,
      validUntil: q.validUntil,
      categories: categories.filter((c) => c.quoteId === q.id).map((c) => c.category),
    });

    const senderName = ctx.user.name || 'Craft & Culture';
    const results: { forwarderId: string; name: string; ok: boolean; error: string | null }[] = [];

    for (const forwarder of forwarders) {
      const contacts = forwarder.contacts;

      if (contacts.length === 0) {
        results.push({ forwarderId: forwarder.id, name: forwarder.name, ok: false, error: 'No email address on file' });
        continue;
      }

      const own = quotes.find((q) => q.forwarderId === forwarder.id && q.id !== won?.id) ?? null;
      const email =
        input.kind === 'request' || input.kind === 'chase'
          ? buildFreightEmail({ kind: input.kind, request, forwarders: [forwarder], senderName })
          : buildFreightEmail({
              kind: input.kind,
              request,
              forwarder,
              quote: input.kind === 'award' ? asQuote(won!) : own ? asQuote(own) : { ...asQuote(won!), forwarderReference: null },
              senderName,
            });

      // One email per address, so nobody sees another forwarder's contacts
      let ok = true;
      let error: string | null = null;
      for (const to of email.to) {
        const sent = await sendLogisticsEmail({ to, subject: email.subject, body: email.body });
        if (!sent.ok) {
          ok = false;
          error = sent.error;
        }
      }

      await db.insert(logisticsQuoteEmails).values({
        requestId: request.id,
        forwarderId: forwarder.id,
        quoteId: input.kind === 'award' ? won!.id : (own?.id ?? null),
        kind: input.kind,
        toEmails: email.to,
        subject: email.subject,
        body: email.body,
        status: ok ? 'sent' : 'failed',
        error,
        sentBy: ctx.user.id,
      });

      if (ok && (input.kind === 'request' || input.kind === 'chase')) {
        const now = new Date();
        await db
          .update(logisticsQuoteRequestRecipients)
          .set(input.kind === 'request' ? { sentAt: now, sentBy: ctx.user.id, updatedAt: now } : { chasedAt: now, updatedAt: now })
          .where(
            and(
              eq(logisticsQuoteRequestRecipients.requestId, request.id),
              eq(logisticsQuoteRequestRecipients.forwarderId, forwarder.id),
            ),
          );
      }

      if (!ok) {
        logger.error('Freight email failed', { requestId: request.id, forwarder: forwarder.name, kind: input.kind, error });
      }

      results.push({ forwarderId: forwarder.id, name: forwarder.name, ok, error });
    }

    if (input.kind === 'request' && results.some((r) => r.ok) && request.status === 'pending') {
      await db
        .update(logisticsQuoteRequests)
        .set({ status: 'in_progress', assignedTo: ctx.user.id, assignedAt: new Date(), updatedAt: new Date() })
        .where(eq(logisticsQuoteRequests.id, request.id));
    }

    return { results, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) };
  });

export default adminSendFreightEmails;
