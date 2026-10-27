import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import type { TransactionalVariables } from 'loops';

import db from '@/database/client';
import { orderEmailOutbox } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import getOrderEmailMode, { ORDER_EMAIL_SHADOW_INBOX } from './getOrderEmailMode';
import getOrderEmailSnapshot from './getOrderEmailSnapshot';
import { ORDER_EMAIL_TEMPLATE_ID } from '../constants';
import buildOrderEmail from '../utils/buildOrderEmail';
import groupOrderEmails from '../utils/groupOrderEmails';
import type { OrderEmailAudience, OrderEmailEvent, OrderStatus } from '../utils/orderEmailTypes';

const BATCH = 100;

/**
 * Send the order emails that are due, the way the switch says
 *
 * Each email is written now, from the order as it stands, so its progress,
 * wines and details are current even if it waited for others to join it.
 * Off: due emails are set aside and never sent later. Shadow: each goes to
 * Kevin's inbox with "[SHADOW for <recipient>]" before the subject. Live: each
 * goes to the partner or distributor.
 *
 * @returns What happened this run
 */
const sendOrderEmails = async () => {
  const mode = await getOrderEmailMode();
  const now = new Date();

  // Claimed in one statement, skipping rows another run holds, so nothing goes twice
  const claimable = db
    .select({ id: orderEmailOutbox.id })
    .from(orderEmailOutbox)
    .where(and(eq(orderEmailOutbox.status, 'pending'), lte(orderEmailOutbox.sendAt, now)))
    .orderBy(asc(orderEmailOutbox.sendAt))
    .limit(BATCH)
    .for('update', { skipLocked: true });

  const due = await db
    .update(orderEmailOutbox)
    .set({ status: 'sending', updatedAt: now })
    .where(and(inArray(orderEmailOutbox.id, claimable), eq(orderEmailOutbox.status, 'pending')))
    .returning();

  if (due.length === 0) return { mode, due: 0, sent: 0, failed: 0 };

  if (mode === 'off') {
    await db
      .update(orderEmailOutbox)
      .set({ status: 'suppressed', sentMode: 'off', updatedAt: now })
      .where(inArray(orderEmailOutbox.id, due.map((row) => row.id)));
    return { mode, due: due.length, sent: 0, failed: 0 };
  }

  const orders = new Map<string, Awaited<ReturnType<typeof getOrderEmailSnapshot>>>();
  for (const orderId of new Set(due.map((row) => row.orderId))) {
    orders.set(orderId, await getOrderEmailSnapshot(orderId));
  }

  let sent = 0;
  let failed = 0;

  for (const { carrier, merged } of groupOrderEmails(due, (id) => orders.get(id)?.snapshot.status ?? null)) {
    const mergedIds = merged.map((row) => row.id);

    const found = carrier ? orders.get(carrier.orderId) : null;
    const stored = carrier?.data as { event?: OrderEmailEvent & { at: string } } | undefined;
    const email =
      carrier && found && stored?.event
        ? buildOrderEmail(
            { ...stored.event, at: new Date(stored.event.at), newStatus: stored.event.newStatus as OrderStatus | null },
            carrier.audience as OrderEmailAudience,
            found.snapshot,
            {
              orderUrl:
                carrier.audience === 'partner'
                  ? `${serverConfig.appUrl}/platform/private-orders/${carrier.orderId}`
                  : `${serverConfig.appUrl}/platform/distributor/orders/${carrier.orderId}`,
              proformaUrl: `${serverConfig.appUrl}/api/distributor/pco/proforma?orderId=${carrier.orderId}`,
            },
            carrier.recipientName || 'Sir or Madam',
          )
        : null;

    // Nothing left to say: every request in the group has since been done
    if (!carrier || !email) {
      const ids = carrier ? [carrier.id, ...mergedIds] : mergedIds;
      if (ids.length)
        await db
          .update(orderEmailOutbox)
          .set({ status: 'merged', sentMode: mode, updatedAt: new Date() })
          .where(inArray(orderEmailOutbox.id, ids));
      continue;
    }

    const to = mode === 'live' ? carrier.recipientEmail : ORDER_EMAIL_SHADOW_INBOX;
    const data = { ...email.data };
    if (mode === 'shadow') data.subject = `[SHADOW for ${carrier.recipientName} <${carrier.recipientEmail}>] ${data.subject}`;

    try {
      await loops.sendTransactionalEmail({
        transactionalId: ORDER_EMAIL_TEMPLATE_ID,
        email: to,
        dataVariables: data as unknown as TransactionalVariables,
      });

      await db
        .update(orderEmailOutbox)
        .set({
          status: mode === 'live' ? 'sent' : 'shadowed',
          sentMode: mode,
          sentTo: to,
          sentAt: new Date(),
          data: { ...(carrier.data as Record<string, unknown>), subject: email.data.subject },
          updatedAt: new Date(),
        })
        .where(eq(orderEmailOutbox.id, carrier.id));

      if (mergedIds.length) {
        await db
          .update(orderEmailOutbox)
          .set({ status: 'merged', mergedInto: carrier.id, sentMode: mode, updatedAt: new Date() })
          .where(inArray(orderEmailOutbox.id, mergedIds));
      }
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Order email failed', { id: carrier.id, orderId: carrier.orderId, error: message });
      await db
        .update(orderEmailOutbox)
        .set({ status: 'failed', sentMode: mode, error: message.slice(0, 1000), updatedAt: new Date() })
        .where(inArray(orderEmailOutbox.id, [carrier.id, ...mergedIds]));
      failed += 1;
    }
  }

  return { mode, due: due.length, sent, failed };
};

export default sendOrderEmails;
