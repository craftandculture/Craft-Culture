import { after } from 'next/server';

import postSlackWebhook from '@/lib/slack/postSlackWebhook';
import logger from '@/utils/logger';

/** The environment variable holding the #warehouse-activity incoming webhook */
export const WAREHOUSE_WEBHOOK_ENV = 'SLACK_WAREHOUSE_WEBHOOK_URL';

const send = async (text: string) => {
  try {
    await postSlackWebhook(WAREHOUSE_WEBHOOK_ENV, { text });
  } catch (error) {
    logger.error('Warehouse activity: Slack post failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Post to #warehouse-activity without ever holding up the warehouse
 *
 * The post is sent after the response has gone back, so a scanner never waits
 * on Slack. Outside a request (e.g. a script) it is simply awaited. Failures
 * are logged and swallowed: a pick or dispatch stands whether or not Slack
 * hears about it.
 *
 * @param text - Slack mrkdwn text
 */
const postWarehouseSlack = async (text: string) => {
  if (!process.env[WAREHOUSE_WEBHOOK_ENV]) return;

  try {
    after(() => send(text));
  } catch {
    await send(text);
  }
};

export default postWarehouseSlack;
