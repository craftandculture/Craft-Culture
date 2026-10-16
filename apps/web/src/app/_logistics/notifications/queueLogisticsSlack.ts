import { after } from 'next/server';

import logger from '@/utils/logger';

import postLogisticsSlack from './postLogisticsSlack';

/**
 * Send a #logistics post after the response, so a mutation never waits on Slack
 *
 * Uses Next's `after()`, which keeps the function alive on Vercel until the
 * post has gone. Called outside a request (a script or a background job),
 * `after()` throws, and the post is sent detached instead. Never throws.
 *
 * @example
 *   queueLogisticsSlack(inboundArrivedMessage(shipment, 'at_warehouse'));
 *
 * @param text - Slack mrkdwn text
 */
const queueLogisticsSlack = (text: string) => {
  const send = async () => {
    await postLogisticsSlack(text);
  };

  try {
    after(send);
  } catch {
    send().catch((error: unknown) => {
      logger.error('Logistics Slack: detached post failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
};

export default queueLogisticsSlack;
