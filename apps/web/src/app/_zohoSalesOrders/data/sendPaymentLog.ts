import { and, eq, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import { zohoPaymentLog } from '@/database/schema';
import postSlackWebhook from '@/lib/slack/postSlackWebhook';
import { listRecentCustomerPayments, listRecentVendorPayments } from '@/lib/zoho/payments';

import formatPaymentLogLine from '../utils/formatPaymentLogLine';
import type { PaymentLogEntry } from '../utils/formatPaymentLogLine';

/** The environment variable holding the #payments-log incoming webhook */
export const PAYMENTS_LOG_WEBHOOK_ENV = 'SLACK_PAYMENTS_LOG_WEBHOOK_URL';

/** Posts per run, so a backlog cannot outrun the cron's time limit */
const PER_RUN = 25;

/**
 * The payments Zoho holds now, received and made, as log entries
 *
 * Both lists are read on every run. A failure on either throws, so a missing
 * Zoho permission shows in the cron log rather than as a quiet half-log.
 */
export const readZohoPayments = async () => {
  const [received, made] = await Promise.all([listRecentCustomerPayments(), listRecentVendorPayments()]);

  return [
    ...received.map((p) => ({
      id: p.payment_id,
      entry: {
        direction: 'received',
        party: p.customer_name ?? 'Unknown customer',
        amount: p.amount ?? 0,
        currency: p.currency_code ?? 'AED',
        date: p.date ?? null,
        documents: p.invoice_numbers || null,
        mode: p.payment_mode || null,
        reference: p.reference_number || null,
        paymentNumber: p.payment_number || null,
      } satisfies PaymentLogEntry,
    })),
    ...made.map((p) => ({
      id: p.payment_id,
      entry: {
        direction: 'made',
        party: p.vendor_name ?? 'Unknown vendor',
        amount: p.amount ?? 0,
        currency: p.currency_code ?? 'AED',
        date: p.date ?? null,
        documents: p.bill_numbers || null,
        mode: p.payment_mode || null,
        reference: p.reference_number || null,
        paymentNumber: p.payment_number || null,
      } satisfies PaymentLogEntry,
    })),
  ];
};

/**
 * Post every Zoho payment, received or made, to #payments-log
 *
 * A payment seen for the first time is stored unposted and then posted, one
 * Slack message each, oldest first. On the very first run for a direction
 * everything Zoho already holds is stored as posted, so the channel does not
 * open with the whole history. A payment is marked posted only after Slack
 * accepts it, so a failed post is retried on the next run.
 *
 * @returns How many payments were posted, and how many are waiting
 */
const sendPaymentLog = async () => {
  const payments = await readZohoPayments();

  for (const direction of ['received', 'made'] as const) {
    const ofDirection = payments.filter((p) => p.entry.direction === direction);
    if (!ofDirection.length) continue;

    const [{ known }] = (await db
      .select({ known: sql<number>`count(*)::int` })
      .from(zohoPaymentLog)
      .where(eq(zohoPaymentLog.direction, direction))) as [{ known: number }];

    // First run for this direction: remember what is there, say nothing
    await db
      .insert(zohoPaymentLog)
      .values(ofDirection.map((p) => ({ zohoPaymentId: p.id, direction, posted: known === 0 })))
      .onConflictDoNothing();
  }

  const ids = payments.map((p) => p.id);
  const unposted = ids.length
    ? await db
        .select({ id: zohoPaymentLog.zohoPaymentId })
        .from(zohoPaymentLog)
        .where(and(inArray(zohoPaymentLog.zohoPaymentId, ids), eq(zohoPaymentLog.posted, false)))
    : [];

  if (!unposted.length) return { posted: 0, waiting: 0 };
  if (!process.env[PAYMENTS_LOG_WEBHOOK_ENV]) {
    return { posted: 0, waiting: unposted.length, reason: 'not_connected' as const };
  }

  const waiting = new Set(unposted.map((row) => row.id));
  const due = payments
    .filter((p) => waiting.has(p.id))
    .sort((a, b) => (a.entry.date ?? '').localeCompare(b.entry.date ?? ''))
    .slice(0, PER_RUN);

  let posted = 0;
  for (const payment of due) {
    await postSlackWebhook(PAYMENTS_LOG_WEBHOOK_ENV, { text: formatPaymentLogLine(payment.entry) });
    await db
      .update(zohoPaymentLog)
      .set({ posted: true, updatedAt: new Date() })
      .where(eq(zohoPaymentLog.zohoPaymentId, payment.id));
    posted += 1;
  }

  return { posted, waiting: waiting.size - posted };
};

export default sendPaymentLog;
