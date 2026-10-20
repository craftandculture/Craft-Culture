import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { zohoInvoices, zohoPaymentAlerts } from '@/database/schema';
import postSlackWebhook from '@/lib/slack/postSlackWebhook';

import formatPaymentAlerts from '../utils/formatPaymentAlerts';

/** The environment variable holding the #payments-received incoming webhook */
export const PAYMENTS_WEBHOOK_ENV = 'SLACK_PAYMENTS_WEBHOOK_URL';

/**
 * Post the payments received since the last run to #payments-received
 *
 * The Zoho invoice sync keeps each invoice's balance current; a balance lower
 * than the one last announced is a payment. An invoice seen for the first time
 * is recorded without a post, so the first run does not announce history. A
 * balance that went up (a reversed payment, an edited invoice) is recorded
 * quietly. Balances advance only after Slack accepts the post, so a failed post
 * is retried on the next run rather than lost.
 *
 * @returns How many payments were posted
 */
const sendPaymentAlerts = async () => {
  // First sight of an invoice: remember its balance, say nothing
  await db.execute(sql`
    INSERT INTO ${zohoPaymentAlerts} (zoho_invoice_id, announced_balance)
    SELECT ${zohoInvoices.zohoInvoiceId}, ${zohoInvoices.balance} FROM ${zohoInvoices}
    ON CONFLICT (zoho_invoice_id) DO NOTHING
  `);

  // Balance went up: record it quietly so a later payment is measured from there
  await db.execute(sql`
    UPDATE ${zohoPaymentAlerts} a SET announced_balance = i.balance, updated_at = now()
    FROM ${zohoInvoices} i
    WHERE i.zoho_invoice_id = a.zoho_invoice_id AND i.balance > a.announced_balance + 0.005
  `);

  const paid = await db
    .select({
      zohoInvoiceId: zohoInvoices.zohoInvoiceId,
      customerName: zohoInvoices.customerName,
      invoiceNumber: zohoInvoices.invoiceNumber,
      currency: zohoInvoices.currencyCode,
      balance: zohoInvoices.balance,
      announced: zohoPaymentAlerts.announcedBalance,
    })
    .from(zohoInvoices)
    .innerJoin(zohoPaymentAlerts, eq(zohoPaymentAlerts.zohoInvoiceId, zohoInvoices.zohoInvoiceId))
    .where(sql`${zohoInvoices.balance} < ${zohoPaymentAlerts.announcedBalance} - 0.005`);

  if (!paid.length) return { posted: 0 };
  if (!process.env[PAYMENTS_WEBHOOK_ENV]) return { posted: 0, waiting: paid.length, reason: 'not_connected' as const };

  await postSlackWebhook(PAYMENTS_WEBHOOK_ENV, {
    text: formatPaymentAlerts(
      paid.map((p) => ({
        customerName: p.customerName,
        invoiceNumber: p.invoiceNumber,
        currency: p.currency ?? 'USD',
        paid: p.announced - p.balance,
        balance: p.balance,
      })),
    ),
  });

  for (const p of paid) {
    await db
      .update(zohoPaymentAlerts)
      .set({ announcedBalance: p.balance, updatedAt: new Date() })
      .where(eq(zohoPaymentAlerts.zohoInvoiceId, p.zohoInvoiceId));
  }

  return { posted: paid.length };
};

export default sendPaymentAlerts;
