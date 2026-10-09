import postSlackWebhook from '@/lib/slack/postSlackWebhook';
import logger from '@/utils/logger';

/** The environment variable holding the #warehouse-activity incoming webhook */
export const WAREHOUSE_WEBHOOK_ENV = 'SLACK_WAREHOUSE_WEBHOOK_URL';

/**
 * Post to #warehouse-activity without ever failing the warehouse action
 *
 * Awaited (Slack answers in well under a second), so the post is sure to go
 * before the request ends. Failures are logged and swallowed: a pick or
 * dispatch stands whether or not Slack hears about it.
 *
 * @param text - Slack mrkdwn text
 * @returns null when Slack accepted the post, otherwise why it did not go
 */
const postWarehouseSlack = async (text: string) => {
  if (!process.env[WAREHOUSE_WEBHOOK_ENV]) {
    logger.warn('Warehouse activity: SLACK_WAREHOUSE_WEBHOOK_URL is not set, nothing posted');
    return 'SLACK_WAREHOUSE_WEBHOOK_URL is not set';
  }

  try {
    await postSlackWebhook(WAREHOUSE_WEBHOOK_ENV, { text });
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Warehouse activity: Slack post failed', { error: message });
    return message;
  }
};

export default postWarehouseSlack;
