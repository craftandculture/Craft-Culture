import { z } from 'zod';

import postSlackWebhook from '@/lib/slack/postSlackWebhook';
import { adminProcedure } from '@/lib/trpc/procedures';

import { PAYMENTS_LOG_WEBHOOK_ENV, readZohoPayments } from '../data/sendPaymentLog';
import formatPaymentLogLine from '../utils/formatPaymentLogLine';

/**
 * Prove #payments-log can read Zoho and reach Slack, without logging anything
 *
 * Reads both payment lists (which fails with Zoho's reason when the connection
 * lacks permission) and, when asked, posts a labelled test message showing the
 * latest payment as it would appear. Nothing is recorded as posted.
 *
 * @example
 *   await trpcClient.zohoSalesOrders.checkPaymentLog.mutate({ postTest: true });
 */
const adminCheckPaymentLog = adminProcedure
  .input(z.object({ postTest: z.boolean().default(false) }))
  .mutation(async ({ input, ctx: { user } }) => {
    const payments = await readZohoPayments();
    const received = payments.filter((p) => p.entry.direction === 'received');
    const made = payments.filter((p) => p.entry.direction === 'made');
    const latest = [received[0], made[0]].filter((p) => p !== undefined).map((p) => formatPaymentLogLine(p.entry));

    if (input.postTest) {
      await postSlackWebhook(PAYMENTS_LOG_WEBHOOK_ENV, {
        text: `*Test* · #payments-log is connected. Every payment recorded in Zoho, received or made, will appear here within about 15 minutes, one line each like this:\n${latest.join('\n')}\n(Sent by ${user.name})`,
      });
    }

    return {
      received: received.length,
      made: made.length,
      webhookSet: Boolean(process.env[PAYMENTS_LOG_WEBHOOK_ENV]),
      latest,
    };
  });

export default adminCheckPaymentLog;
