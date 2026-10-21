import { TRPCError } from '@trpc/server';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsForwarders,
  logisticsQuoteAttachments,
  logisticsQuoteEmails,
  logisticsQuoteLineItems,
  logisticsQuoteRequestAttachments,
  logisticsQuoteRequestRecipients,
  logisticsQuoteRequests,
  logisticsQuotes,
  users,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getSuggestedClientPrice from '../data/getSuggestedClientPrice';
import logisticsEmailTemplateId from '../utils/logisticsEmailTemplateId';
import quoteTotalUsd from '../utils/quoteTotalUsd';
import quoteUnitPrices from '../utils/quoteUnitPrices';

/**
 * Get a single quote request with full details
 *
 * Returns the request with requester info, attachments, and linked quotes.
 */
const adminGetQuoteRequest = adminProcedure
  .input(z.object({ requestId: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    const { requestId } = input;

    // Get request with requester info
    const [request] = await db
      .select()
      .from(logisticsQuoteRequests)
      .where(eq(logisticsQuoteRequests.id, requestId));

    if (!request) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote request not found',
      });
    }

    // Get requester info
    const [requestData] = await db
      .select({
        requestedBy: logisticsQuoteRequests.requestedBy,
        assignedTo: logisticsQuoteRequests.assignedTo,
        completedBy: logisticsQuoteRequests.completedBy,
      })
      .from(logisticsQuoteRequests)
      .where(eq(logisticsQuoteRequests.id, requestId));

    const [requester] = requestData?.requestedBy
      ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, requestData.requestedBy))
      : [null];

    const [assignee] = requestData?.assignedTo
      ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, requestData.assignedTo))
      : [null];

    const [completedByUser] = requestData?.completedBy
      ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, requestData.completedBy))
      : [null];

    // Get attachments
    const attachments = await db
      .select()
      .from(logisticsQuoteRequestAttachments)
      .where(eq(logisticsQuoteRequestAttachments.requestId, requestId));

    // Linked quotes, priced in USD per bottle and per 75cl, cheapest per 75cl first
    const quoteRows = await db
      .select({
        id: logisticsQuotes.id,
        quoteNumber: logisticsQuotes.quoteNumber,
        forwarderId: logisticsQuotes.forwarderId,
        forwarderName: logisticsQuotes.forwarderName,
        forwarderEmail: logisticsQuotes.forwarderEmail,
        forwarderReference: logisticsQuotes.forwarderReference,
        totalPrice: logisticsQuotes.totalPrice,
        currency: logisticsQuotes.currency,
        totalUsd: logisticsQuotes.totalUsd,
        transitDays: logisticsQuotes.transitDays,
        status: logisticsQuotes.status,
        validUntil: logisticsQuotes.validUntil,
        shipmentId: logisticsQuotes.shipmentId,
        createdAt: logisticsQuotes.createdAt,
      })
      .from(logisticsQuotes)
      .where(eq(logisticsQuotes.requestId, requestId));

    const quoteIds = quoteRows.map((q) => q.id);
    const [lines, quoteFiles] = quoteIds.length
      ? await Promise.all([
          db
            .select({ quoteId: logisticsQuoteLineItems.quoteId, category: logisticsQuoteLineItems.category })
            .from(logisticsQuoteLineItems)
            .where(inArray(logisticsQuoteLineItems.quoteId, quoteIds)),
          db
            .select()
            .from(logisticsQuoteAttachments)
            .where(inArray(logisticsQuoteAttachments.quoteId, quoteIds)),
        ])
      : [[], []];

    const now = Date.now();
    const quotes = quoteRows
      .map((q) => {
        const usd = quoteTotalUsd(q);

        return {
          ...q,
          totalUsd: usd,
          ...quoteUnitPrices(usd, request.totalBottles, request.total75clEquivalents),
          isExpired: q.status === 'expired' || (q.status === 'pending' && !!q.validUntil && q.validUntil.getTime() < now),
          categories: [...new Set(lines.filter((l) => l.quoteId === q.id).map((l) => l.category))],
          attachments: quoteFiles.filter((f) => f.quoteId === q.id),
        };
      })
      .sort(
        (a, b) =>
          (a.per75clUsd ?? a.totalUsd ?? Number.MAX_VALUE) - (b.per75clUsd ?? b.totalUsd ?? Number.MAX_VALUE),
      );

    // The forwarders asked, with their contacts, so the page writes their emails
    const recipients = await db
      .select({
        forwarderId: logisticsQuoteRequestRecipients.forwarderId,
        sentAt: logisticsQuoteRequestRecipients.sentAt,
        chasedAt: logisticsQuoteRequestRecipients.chasedAt,
        outcome: logisticsQuoteRequestRecipients.outcome,
        name: logisticsForwarders.name,
        contacts: logisticsForwarders.contacts,
      })
      .from(logisticsQuoteRequestRecipients)
      .innerJoin(logisticsForwarders, eq(logisticsForwarders.id, logisticsQuoteRequestRecipients.forwarderId))
      .where(eq(logisticsQuoteRequestRecipients.requestId, requestId))
      .orderBy(asc(logisticsForwarders.name));

    const suggestedClientPrice = await getSuggestedClientPrice(request);

    // What went from logistics@, newest first; empty if the table is not there yet
    const emails = await db
      .select({
        id: logisticsQuoteEmails.id,
        forwarderId: logisticsQuoteEmails.forwarderId,
        kind: logisticsQuoteEmails.kind,
        toEmails: logisticsQuoteEmails.toEmails,
        subject: logisticsQuoteEmails.subject,
        status: logisticsQuoteEmails.status,
        error: logisticsQuoteEmails.error,
        createdAt: logisticsQuoteEmails.createdAt,
      })
      .from(logisticsQuoteEmails)
      .where(eq(logisticsQuoteEmails.requestId, requestId))
      .orderBy(desc(logisticsQuoteEmails.createdAt))
      .catch(() => []);

    return {
      ...request,
      requester,
      assignee,
      completedByUser,
      attachments,
      quotes,
      recipients,
      suggestedClientPrice,
      emails,
      /** Whether the page can send from logistics@, or only offers emails to copy */
      canSendEmail: !!logisticsEmailTemplateId(),
      /** Signs the emails the page writes */
      senderName: ctx.user.name || 'Craft & Culture',
    };
  });

export default adminGetQuoteRequest;
