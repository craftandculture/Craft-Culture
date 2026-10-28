import { and, asc, eq, gt, inArray, isNotNull, lte, or } from 'drizzle-orm';

import settingsUpdateController from '@/app/_admin/controllers/settingsUpdateController';
import db from '@/database/client';
import { orderEmailOutbox, partners, privateClientOrderActivityLogs, settings, users } from '@/database/schema';
import logger from '@/utils/logger';

import getOrderEmailRecipients from './getOrderEmailRecipients';
import getOrderEmailSnapshot from './getOrderEmailSnapshot';
import orderEmailCopy from '../utils/orderEmailCopy';
import type { OrderEmailAudience, OrderEmailEvent, OrderStatus } from '../utils/orderEmailTypes';

/** How far the queue has read the activity log */
export const ORDER_EMAIL_CURSOR_SETTING = 'pco_emails.cursor';

/** Events this recent are left for the next run, so a burst lands together */
const SETTLE_MS = 60 * 1000;

/** Each email waits this long, so the events that follow it combine */
const MERGE_WINDOW_MS = 3 * 60 * 1000;

const BATCH = 500;

/**
 * Read new order events from the activity log and queue the emails they call for
 *
 * Reads every status change and shared note since the last run. For each, the
 * partner and the distributor are asked in turn whether the event concerns
 * them (orderEmailCopy); the party that caused the event is never emailed
 * about it. Private Cellar orders are left to the cellar's own emails.
 *
 * The first run only records where the log stands, so switching this on never
 * sends emails about the past.
 *
 * @returns How many events were read and emails queued
 */
const queueOrderEmails = async () => {
  const until = new Date(Date.now() - SETTLE_MS);

  const [cursorRow] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, ORDER_EMAIL_CURSOR_SETTING)).limit(1);
  const cursor = cursorRow?.value ? new Date(cursorRow.value) : null;

  if (!cursor || Number.isNaN(cursor.getTime())) {
    await settingsUpdateController({ key: ORDER_EMAIL_CURSOR_SETTING, value: until.toISOString() });
    return { events: 0, queued: 0, started: true };
  }

  const logs = await db
    .select({
      id: privateClientOrderActivityLogs.id,
      orderId: privateClientOrderActivityLogs.orderId,
      userId: privateClientOrderActivityLogs.userId,
      partnerId: privateClientOrderActivityLogs.partnerId,
      action: privateClientOrderActivityLogs.action,
      previousStatus: privateClientOrderActivityLogs.previousStatus,
      newStatus: privateClientOrderActivityLogs.newStatus,
      notes: privateClientOrderActivityLogs.notes,
      metadata: privateClientOrderActivityLogs.metadata,
      createdAt: privateClientOrderActivityLogs.createdAt,
    })
    .from(privateClientOrderActivityLogs)
    .where(
      and(
        gt(privateClientOrderActivityLogs.createdAt, cursor),
        lte(privateClientOrderActivityLogs.createdAt, until),
        or(isNotNull(privateClientOrderActivityLogs.newStatus), eq(privateClientOrderActivityLogs.action, 'note_added')),
      ),
    )
    .orderBy(asc(privateClientOrderActivityLogs.createdAt))
    .limit(BATCH);

  if (logs.length === 0) {
    await settingsUpdateController({ key: ORDER_EMAIL_CURSOR_SETTING, value: until.toISOString() });
    return { events: 0, queued: 0, started: false };
  }

  // Note authors, by name and side
  const authorIds = [...new Set(logs.filter((l) => l.action === 'note_added' && l.userId).map((l) => l.userId!))];
  const partnerIds = [...new Set(logs.filter((l) => l.action === 'note_added' && l.partnerId).map((l) => l.partnerId!))];
  const [authors, authorParties] = await Promise.all([
    authorIds.length ? db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, authorIds)) : [],
    partnerIds.length
      ? db.select({ id: partners.id, name: partners.businessName }).from(partners).where(inArray(partners.id, partnerIds))
      : [],
  ]);
  const authorName = new Map(authors.map((a) => [a.id, a.name]));
  const authorEmail = new Map(authors.map((a) => [a.id, a.email?.trim().toLowerCase()]));
  const partyName = new Map(authorParties.map((p) => [p.id, p.name]));

  const snapshots = new Map<string, Awaited<ReturnType<typeof getOrderEmailSnapshot>>>();
  const recipientsOf = new Map<string, Awaited<ReturnType<typeof getOrderEmailRecipients>>>();
  let queued = 0;

  for (const log of logs) {
    try {
      if (!snapshots.has(log.orderId)) snapshots.set(log.orderId, await getOrderEmailSnapshot(log.orderId));
      const found = snapshots.get(log.orderId);
      if (!found || found.partnerType === 'private_collector') continue;

      const event: OrderEmailEvent = {
        action: log.action,
        newStatus: log.newStatus as OrderStatus | null,
        previousStatus: log.previousStatus as OrderStatus | null,
        notes: log.notes,
        authorName: log.userId ? (authorName.get(log.userId) ?? null) : null,
        authorParty: log.partnerId ? (partyName.get(log.partnerId) ?? null) : 'Craft & Culture',
        at: log.createdAt,
      };

      const parties: [OrderEmailAudience, string | null][] = [
        ['partner', found.partnerId],
        ['distributor', found.distributorId],
      ];

      for (const [audience, partyId] of parties) {
        // Nobody hears about what their own side just did
        if (!partyId || partyId === log.partnerId) continue;

        const copy = orderEmailCopy(event, audience, found.snapshot);
        if (!copy) continue;

        if (!recipientsOf.has(partyId)) recipientsOf.set(partyId, await getOrderEmailRecipients(partyId));

        for (const recipient of recipientsOf.get(partyId) ?? []) {
          // The author of a note is never sent their own note
          if (log.userId && authorEmail.get(log.userId) === recipient.email.toLowerCase()) continue;

          const inserted = await db
            .insert(orderEmailOutbox)
            .values({
              dedupeKey: `${recipient.email.toLowerCase()}:${log.id}`,
              orderId: log.orderId,
              activityLogId: log.id,
              audience,
              event: log.action === 'note_added' ? 'note_added' : String(log.newStatus),
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              data: { event: { ...event, at: event.at.toISOString() }, subject: copy.subject },
              isAction: copy.isAction,
              sendAt: new Date(log.createdAt.getTime() + MERGE_WINDOW_MS),
            })
            .onConflictDoNothing({ target: orderEmailOutbox.dedupeKey })
            .returning({ id: orderEmailOutbox.id });
          queued += inserted.length;
        }
      }
    } catch (error) {
      logger.error('Order email: could not queue an event', {
        logId: log.id,
        orderId: log.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const last = logs[logs.length - 1]!;
  // A full batch stops at its last row; otherwise everything up to `until` is read
  const next = logs.length === BATCH ? last.createdAt : until;
  await settingsUpdateController({ key: ORDER_EMAIL_CURSOR_SETTING, value: next.toISOString() });

  return { events: logs.length, queued, started: false };
};

export default queueOrderEmails;
