import postSlackWebhook from '@/lib/slack/postSlackWebhook';
import { adminProcedure } from '@/lib/trpc/procedures';

import { PAYMENTS_WEBHOOK_ENV } from '../data/sendPaymentAlerts';

/**
 * Post a labelled test message to #payments-received
 *
 * Proves the webhook is set and reaches the channel without waiting for a
 * real payment. Fails with the reason when it is not.
 *
 * @example
 *   await trpcClient.zohoSalesOrders.testPaymentAlerts.mutate();
 */
const adminTestPaymentAlerts = adminProcedure.mutation(async ({ ctx: { user } }) => {
  await postSlackWebhook(PAYMENTS_WEBHOOK_ENV, {
    text: `*Test* · payment alerts are connected. Client payments recorded in Zoho will appear here within about half an hour. (Sent by ${user.name})`,
  });

  return { posted: true };
});

export default adminTestPaymentAlerts;
