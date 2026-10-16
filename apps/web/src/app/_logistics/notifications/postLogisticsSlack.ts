import postSlackWebhook from '@/lib/slack/postSlackWebhook';
import logger from '@/utils/logger';

/**
 * The environment variable holding the #logistics incoming webhook. Set it on
 * the craft-culture project in the CraftCulture Pro team (the one serving
 * wine.craftculture.xyz); a changed value needs a fresh deployment.
 */
export const LOGISTICS_WEBHOOK_ENV = 'SLACK_LOGISTICS_WEBHOOK_URL';

/**
 * Post to #logistics without ever failing the action behind it
 *
 * When the webhook is not set, a warning is logged and nothing is posted.
 * Slack failures are logged and swallowed: a status change or the morning
 * digest stands whether or not Slack hears about it.
 *
 * @example
 *   await postLogisticsSlack('*SHP-0042* arrived at the warehouse');
 *
 * @param text - Slack mrkdwn text
 * @returns null when Slack accepted the post, otherwise why it did not go
 */
const postLogisticsSlack = async (text: string) => {
  if (!process.env[LOGISTICS_WEBHOOK_ENV]) {
    logger.warn(`Logistics Slack: ${LOGISTICS_WEBHOOK_ENV} is not set, nothing posted`);
    return `${LOGISTICS_WEBHOOK_ENV} is not set`;
  }

  try {
    await postSlackWebhook(LOGISTICS_WEBHOOK_ENV, { text });
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Logistics Slack: post failed', { error: message });
    return message;
  }
};

export default postLogisticsSlack;
